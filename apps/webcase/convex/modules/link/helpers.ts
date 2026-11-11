import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { normalizeTags } from '../../../shared/tags'

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
