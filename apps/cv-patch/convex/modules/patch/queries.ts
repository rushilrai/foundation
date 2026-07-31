import { listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent'
import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { components } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { internalQuery, query } from '../../_generated/server'
import { getById as getResumeById } from '../resume/helpers'
import { getByExternalId } from '../user/helpers'
import {
  getById,
  getByIdWithAuth,
  getPatchesForResume,
  getUserPatches,
} from './helpers'

export const listForResume = query({
  args: { resumeId: v.id('resumes') },
  handler: async (
    ctx,
    args,
  ): Promise<{ patches: Array<Doc<'patches'>> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    // Verify resume belongs to user
    const resume = await getResumeById(ctx, args.resumeId)
    if (!resume) {
      return { error: 'RESUME_NOT_FOUND' }
    }
    if (resume.userId !== user._id) {
      return { error: 'FORBIDDEN' }
    }

    const patches = await getPatchesForResume(ctx, args.resumeId)

    return { patches }
  },
})

export const list = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ patches: Array<Doc<'patches'>> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    const patches = await getUserPatches(ctx, user._id)

    return { patches }
  },
})

export const get = query({
  args: { patchId: v.id('patches') },
  handler: async (
    ctx,
    args,
  ): Promise<{ patch: Doc<'patches'> } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.patchId)

    if ('error' in result) {
      return result
    }

    return { patch: result.patch }
  },
})

export type PatchVersionWithUrls = Doc<'patchVersions'> & {
  pdfUrl: string | null
  docxUrl: string | null
}

export const listVersions = query({
  args: { patchId: v.id('patches') },
  handler: async (
    ctx,
    args,
  ): Promise<{ versions: Array<PatchVersionWithUrls> } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.patchId)

    if ('error' in result) {
      return result
    }

    const versions = await ctx.db
      .query('patchVersions')
      .withIndex('by_patchId', (q) => q.eq('patchId', args.patchId))
      .order('desc')
      .collect()

    const withUrls = await Promise.all(
      versions.map(async (version) => ({
        ...version,
        pdfUrl: version.pdfFileId
          ? await ctx.storage.getUrl(version.pdfFileId)
          : null,
        docxUrl: await ctx.storage.getUrl(version.patchedFileId),
      })),
    )

    return { versions: withUrls }
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

    const patch = await ctx.db
      .query('patches')
      .withIndex('by_threadId', (q) => q.eq('threadId', args.threadId))
      .unique()

    if (!patch || patch.deleted || patch.userId !== user._id) {
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

// Internal query for use in actions
export const getByIdInternal = internalQuery({
  args: { patchId: v.id('patches') },
  handler: async (ctx, args): Promise<Doc<'patches'> | null> => {
    return await getById(ctx, args.patchId)
  },
})

export const getByIdOwnedInternal = internalQuery({
  args: { patchId: v.id('patches'), externalId: v.string() },
  handler: async (ctx, args): Promise<Doc<'patches'> | null> => {
    const user = await getByExternalId(ctx, args.externalId)
    if (!user) {
      return null
    }

    const patch = await getById(ctx, args.patchId)
    if (!patch || patch.userId !== user._id) {
      return null
    }

    return patch
  },
})

export const getByThreadIdInternal = internalQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args): Promise<Doc<'patches'> | null> => {
    const patch = await ctx.db
      .query('patches')
      .withIndex('by_threadId', (q) => q.eq('threadId', args.threadId))
      .unique()

    if (!patch || patch.deleted) {
      return null
    }

    return patch
  },
})
