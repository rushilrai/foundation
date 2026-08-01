import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { getByExternalId } from '../user/helpers'

export const getById = async (
  ctx: QueryCtx | MutationCtx,
  profileId: Id<'profiles'>,
) => {
  const profile = await ctx.db.get(profileId)

  if (!profile || profile.deleted) {
    return null
  }

  return profile
}

export const getByIdWithAuth = async (
  ctx: QueryCtx | MutationCtx,
  profileId: Id<'profiles'>,
): Promise<
  { profile: Doc<'profiles'>; user: Doc<'users'> } | { error: string }
> => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    return { error: 'UNAUTHORIZED' }
  }

  const user = await getByExternalId(ctx, identity.subject)
  if (!user) {
    return { error: 'USER_NOT_FOUND' }
  }

  const profile = await getById(ctx, profileId)
  if (!profile) {
    return { error: 'PROFILE_NOT_FOUND' }
  }

  if (profile.userId !== user._id) {
    return { error: 'FORBIDDEN' }
  }

  return { profile, user }
}

export const getUserProfiles = async (
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
) => {
  const profiles = await ctx.db
    .query('profiles')
    .withIndex('by_userId_deleted', (q) =>
      q.eq('userId', userId).eq('deleted', false),
    )
    .order('desc')
    .collect()

  return profiles
}

export const getDocumentById = async (
  ctx: QueryCtx | MutationCtx,
  documentId: Id<'documents'>,
) => {
  const document = await ctx.db.get(documentId)

  if (!document || document.deleted) {
    return null
  }

  return document
}

export const getDocumentsForProfile = async (
  ctx: QueryCtx | MutationCtx,
  profileId: Id<'profiles'>,
) => {
  const documents = await ctx.db
    .query('documents')
    .withIndex('by_profileId_deleted', (q) =>
      q.eq('profileId', profileId).eq('deleted', false),
    )
    .order('desc')
    .collect()

  return documents
}
