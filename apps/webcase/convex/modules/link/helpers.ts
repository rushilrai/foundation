import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { normalizeTags } from '../../../shared/tags'
import {
  isPlaceholderTitle,
  isRewrittenUrl,
  urlTitle,
} from '../../../shared/url'
import { matchSite } from '../../lib/metadata/sites'

export const mergeTags = (
  existing: Array<string>,
  incoming: Array<string>,
): Array<string> => normalizeTags([...existing, ...incoming])

// `url` must already be normalised (parseHttpUrl(...).href).
export const getByUrl = async (
  ctx: QueryCtx,
  userId: string,
  url: string,
): Promise<Doc<'links'> | null> =>
  await ctx.db
    .query('links')
    .withIndex('by_user_url', (q) => q.eq('userId', userId).eq('url', url))
    .first()

// The link when it exists and belongs to the user, else null. Callers
// report both cases as NOT_FOUND so ids of other users' links leak nothing.
export const getOwned = async (
  ctx: QueryCtx,
  userId: string,
  linkId: Id<'links'>,
): Promise<Doc<'links'> | null> => {
  const link = await ctx.db.get(linkId)

  return link && link.userId === userId ? link : null
}

// Newest saved first.
export const getUserLinks = async (
  ctx: QueryCtx,
  userId: string,
): Promise<Array<Doc<'links'>>> =>
  await ctx.db
    .query('links')
    .withIndex('by_user_savedAt', (q) => q.eq('userId', userId))
    .order('desc')
    .collect()

const getLinkCountRow = async (ctx: QueryCtx, userId: string) =>
  await ctx.db
    .query('linkCounts')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()

// How many links the user has. Reads one row, except for a user whose
// links predate the counter, whose library is counted until their next
// insert or delete writes the row.
export const countLinks = async (
  ctx: QueryCtx,
  userId: string,
): Promise<number> => {
  const row = await getLinkCountRow(ctx, userId)

  return row ? row.count : (await getUserLinks(ctx, userId)).length
}

// Call after inserting or deleting the user's links, in the same mutation,
// with how many were added (negative for removed). Mutations are
// transactions, so the count can't drift from the table.
export const changeLinkCount = async (
  ctx: MutationCtx,
  userId: string,
  delta: number,
): Promise<void> => {
  const row = await getLinkCountRow(ctx, userId)
  if (row) {
    await ctx.db.patch(row._id, { count: Math.max(0, row.count + delta) })
    return
  }

  // The first change since counting began: the mutation already sees its
  // own writes, so this count includes them.
  await ctx.db.insert('linkCounts', {
    userId,
    count: (await getUserLinks(ctx, userId)).length,
  })
}

// A stored title without its site rule's decoration (cleanTitle: Reddit's
// "From the … community on Reddit: ", " : Google Search"), empty when
// nothing was left, or null when the title has none. `url` is the link's
// parsed URL.
export const undecoratedTitle = (title: string, url: URL): string | null => {
  const cleanTitle = matchSite(url)?.cleanTitle
  if (!cleanTitle) {
    return null
  }
  const cleaned = cleanTitle(title)?.trim() ?? ''
  return cleaned === title.trim() ? null : cleaned
}

// A stored title enrichment may replace: a stand-in for the URL, or one
// carrying its site's decoration. Any other title is the user's (an
// imported Pocket title is a real one) and stays. `rawUrl` is the stored
// URL, `url` its parsed form.
export const isReplaceableTitle = (
  title: string,
  rawUrl: string,
  url: URL,
): boolean =>
  isPlaceholderTitle(title, rawUrl) || undecoratedTitle(title, url) !== null

// True when the stored description is one the link's site gives every
// page (Reddit's "Explore this post and more…"), which enrichment replaces.
export const hasGenericDescription = (
  description: string | undefined,
  url: URL,
): boolean => {
  const isGeneric = matchSite(url)?.isGenericDescription
  return !!description && !!isGeneric?.(description)
}

// Why re-enrichment would refresh a link, empty when it is already as good
// as its site rule gives: a stand-in or decorated title, the site's generic
// description, a redirect wrapper stored before wrappers were unwrapped, or
// a field its site rule fills (resolve or fromUrl) that the link still
// lacks. `url` is parseHttpUrl(link.url).
export const reenrichReasons = (
  link: Doc<'links'>,
  url: URL,
): Array<string> => {
  const site = matchSite(url)
  const reasons: Array<string> = []
  // A title the site rule took from the URL is already the best it has
  // when nothing better was read ("@fatlulus on Instagram").
  if (
    isPlaceholderTitle(link.title, link.url) &&
    link.title.trim() !== urlTitle(url)
  ) {
    reasons.push('placeholder title')
  }
  if (undecoratedTitle(link.title, url) !== null) {
    reasons.push(`decorated title (${site?.site})`)
  }
  if (hasGenericDescription(link.description, url)) {
    reasons.push(`generic description (${site?.site})`)
  }
  if (isRewrittenUrl(link.url)) {
    reasons.push('redirect wrapper')
  }
  if (site?.provides.description && !link.description) {
    reasons.push(`no description (${site.site})`)
  }
  if (site?.provides.image && !link.image) {
    reasons.push(`no image (${site.site})`)
  }

  return reasons
}
