import type { Doc, Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
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
