import { v } from 'convex/values'

import type { Doc } from '../../_generated/dataModel'
import { internalQuery, query } from '../../_generated/server'
import { getByExternalId } from '../user/helpers'
import {
  getById,
  getByIdWithAuth,
  getDocumentsForProfile,
  getUserProfiles,
} from './helpers'

export const list = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ profiles: Array<Doc<'profiles'>> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    const profiles = await getUserProfiles(ctx, user._id)

    return { profiles }
  },
})

export const get = query({
  args: { profileId: v.id('profiles') },
  handler: async (
    ctx,
    args,
  ): Promise<{ profile: Doc<'profiles'> } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    return { profile: result.profile }
  },
})

export const listDocuments = query({
  args: { profileId: v.id('profiles') },
  handler: async (
    ctx,
    args,
  ): Promise<{ documents: Array<Doc<'documents'>> } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    const documents = await getDocumentsForProfile(ctx, args.profileId)

    return { documents }
  },
})

export const getByIdInternal = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args): Promise<Doc<'profiles'> | null> => {
    return await getById(ctx, args.profileId)
  },
})

export const getByThreadIdInternal = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args): Promise<Doc<'profiles'> | null> => {
    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_threadId', (q) => q.eq('threadId', args.threadId))
      .unique()

    if (!profile || profile.deleted) {
      return null
    }

    return profile
  },
})
