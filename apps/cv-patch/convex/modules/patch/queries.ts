import { internalQuery, query } from 'convex/_generated/server'
import { v } from 'convex/values'

import { getById as getResumeById } from '../resume/helpers'
import { getByExternalId } from '../user/helpers'
import {
  getById,
  getByIdWithAuth,
  getPatchesForResume,
  getUserPatches,
} from './helpers'
import type { Doc } from 'convex/_generated/dataModel'

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

// Internal query for use in actions
export const getByIdInternal = internalQuery({
  args: { patchId: v.id('patches') },
  handler: async (ctx, args): Promise<Doc<'patches'> | null> => {
    return await getById(ctx, args.patchId)
  },
})
