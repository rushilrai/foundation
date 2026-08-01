import { listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { components } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { internalQuery, query } from '../../_generated/server'
import { getByExternalId } from '../user/helpers'
import {
  getById,
  getByIdWithAuth,
  getDocumentById,
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

// Throws on auth failure — paginated query hooks cannot carry error unions.
export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('UNAUTHORIZED')
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      throw new Error('USER_NOT_FOUND')
    }

    const profile = await ctx.db
      .query('profiles')
      .withIndex('by_threadId', (q) => q.eq('threadId', args.threadId))
      .unique()

    if (!profile || profile.deleted || profile.userId !== user._id) {
      throw new Error('FORBIDDEN')
    }

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    })
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    })

    return { ...paginated, streams }
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

export const getDocumentOwnedInternal = internalQuery({
  args: { documentId: v.id('documents'), externalId: v.string() },
  handler: async (ctx, args): Promise<Doc<'documents'> | null> => {
    const user = await getByExternalId(ctx, args.externalId)
    if (!user) {
      return null
    }

    const document = await getDocumentById(ctx, args.documentId)
    if (!document || document.userId !== user._id) {
      return null
    }

    return document
  },
})

export const getDocumentByIdInternal = internalQuery({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args): Promise<Doc<'documents'> | null> => {
    return await getDocumentById(ctx, args.documentId)
  },
})

export const listDocumentsInternal = internalQuery({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args): Promise<Array<Doc<'documents'>>> => {
    return await getDocumentsForProfile(ctx, args.profileId)
  },
})
