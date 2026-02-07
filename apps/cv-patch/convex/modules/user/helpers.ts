import type { Doc } from 'convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from 'convex/_generated/server'

export const getByExternalId = async (
  ctx: QueryCtx | MutationCtx,
  externalId: Doc<'users'>['externalId'],
) => {
  const user = await ctx.db
    .query('users')
    .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
    .unique()

  if (!user || user.deleted) {
    return null
  }

  return user
}
