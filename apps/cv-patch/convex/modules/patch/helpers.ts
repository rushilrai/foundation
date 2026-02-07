import { getByExternalId } from '../user/helpers'
import type { Doc, Id } from 'convex/_generated/dataModel'
import type { MutationCtx, QueryCtx } from 'convex/_generated/server'


export const getById = async (
  ctx: QueryCtx | MutationCtx,
  patchId: Id<'patches'>,
) => {
  const patch = await ctx.db.get(patchId)

  if (!patch || patch.deleted) {
    return null
  }

  return patch
}

export const getByIdWithAuth = async (
  ctx: QueryCtx | MutationCtx,
  patchId: Id<'patches'>,
): Promise<
  { patch: Doc<'patches'>; user: Doc<'users'> } | { error: string }
> => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    return { error: 'UNAUTHORIZED' }
  }

  const user = await getByExternalId(ctx, identity.subject)
  if (!user) {
    return { error: 'USER_NOT_FOUND' }
  }

  const patch = await getById(ctx, patchId)
  if (!patch) {
    return { error: 'PATCH_NOT_FOUND' }
  }

  if (patch.userId !== user._id) {
    return { error: 'FORBIDDEN' }
  }

  return { patch, user }
}

export const getPatchesForResume = async (
  ctx: QueryCtx | MutationCtx,
  resumeId: Id<'resumes'>,
) => {
  const patches = await ctx.db
    .query('patches')
    .withIndex('by_resumeId_deleted', (q) =>
      q.eq('resumeId', resumeId).eq('deleted', false),
    )
    .order('desc')
    .collect()

  return patches
}

export const getUserPatches = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
) => {
  const patches = await ctx.db
    .query('patches')
    .withIndex('by_userId_deleted', (q) =>
      q.eq('userId', userId).eq('deleted', false),
    )
    .order('desc')
    .collect()

  return patches
}
