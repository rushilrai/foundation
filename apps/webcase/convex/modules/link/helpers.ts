import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

export const MAX_TAG_LENGTH = 40
export const MAX_TAGS = 20
export const MAX_TITLE_LENGTH = 300
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_DOMAIN_LENGTH = 253
export const MAX_IMAGE_URL_LENGTH = 2048

// Lowercase, trimmed, inner whitespace collapsed, at most 40 characters,
// de-duplicated in first-seen order, at most 20.
export const normalizeTags = (tags: Array<string>): Array<string> => {
  const seen = new Set<string>()

  for (const raw of tags) {
    const tag = raw
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TAG_LENGTH)
      .trim()
    if (tag) {
      seen.add(tag)
    }
    if (seen.size === MAX_TAGS) {
      break
    }
  }

  return [...seen]
}

export const mergeTags = (
  existing: Array<string>,
  incoming: Array<string>,
): Array<string> => normalizeTags([...existing, ...incoming])

export const capText = (
  value: string | undefined,
  max: number,
): string | undefined => {
  const text = value?.replace(/\s+/g, ' ').trim()
  if (!text) {
    return undefined
  }

  return text.slice(0, max)
}

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
