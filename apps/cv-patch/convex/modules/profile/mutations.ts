import { createThread, saveMessage } from '@convex-dev/agent'
import { v } from 'convex/values'

import { components, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { internalMutation, mutation } from '../../_generated/server'
import {
  getEmptyProfileData,
  type ProfileData,
} from '../../../shared/profileSchema'
import { MAX_HEADER_LINKS } from '../../../shared/resumeSchema'
import { rateLimiter } from '../../configs/rateLimiter'
import { profileDataValidator } from '../common/profileData'
import { ratingValidator } from '../common/rating'
import { getByExternalId } from '../user/helpers'
import {
  getByIdWithAuth,
  getDocumentById,
  getDocumentsForProfile,
} from './helpers'

// A run older than this is considered crashed and no longer blocks new runs.
const AGENT_RUN_STALE_MS = 10 * 60 * 1000

const isAgentBusy = (agentRunningSince: number | undefined): boolean =>
  agentRunningSince !== undefined &&
  Date.now() - agentRunningSince < AGENT_RUN_STALE_MS

export const create = mutation({
  args: {
    title: v.string(),
    roleBrief: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ profileId: Id<'profiles'> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    const data: ProfileData = {
      ...getEmptyProfileData(),
      roleBrief: args.roleBrief ?? '',
    }

    try {
      const profileId = await ctx.db.insert('profiles', {
        userId: user._id,
        title: args.title,
        data,
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      return { profileId }
    } catch (error) {
      console.error('Error creating profile', error)
      return { error: 'PROFILE_CREATE_FAILED' }
    }
  },
})

export const update = mutation({
  args: {
    profileId: v.id('profiles'),
    title: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    try {
      await ctx.db.patch(args.profileId, {
        ...(args.title !== undefined && { title: args.title }),
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error updating profile', error)
      return { error: 'PROFILE_UPDATE_FAILED' }
    }
  },
})

export const updateData = mutation({
  args: {
    profileId: v.id('profiles'),
    data: profileDataValidator,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    if (args.data.header.links.length > MAX_HEADER_LINKS) {
      return { error: 'TOO_MANY_HEADER_LINKS' }
    }

    try {
      await ctx.db.patch(args.profileId, {
        data: args.data,
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error updating profile data', error)
      return { error: 'PROFILE_DATA_UPDATE_FAILED' }
    }
  },
})

export const remove = mutation({
  args: { profileId: v.id('profiles') },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    try {
      await ctx.db.patch(args.profileId, {
        deleted: true,
        updatedAt: Date.now(),
      })

      // Documents are only reachable through their profile, so cascade the soft delete.
      const documents = await getDocumentsForProfile(ctx, args.profileId)
      for (const document of documents) {
        await ctx.db.patch(document._id, {
          deleted: true,
          updatedAt: Date.now(),
        })
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting profile', error)
      return { error: 'PROFILE_DELETE_FAILED' }
    }
  },
})

export const sendMessage = mutation({
  args: {
    profileId: v.id('profiles'),
    // Client-only hint for the optimistic update; the server derives it.
    threadId: v.optional(v.string()),
    prompt: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    const { profile, user } = result

    if (!args.prompt.trim()) {
      return { error: 'EMPTY_MESSAGE' }
    }

    if (isAgentBusy(profile.agentRunningSince)) {
      return { error: 'AGENT_BUSY' }
    }

    const { ok } = await rateLimiter.limit(ctx, 'sendAgentMessage', {
      key: user._id,
    })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    try {
      let threadId = profile.threadId

      // The builder thread is created lazily on the first message.
      if (!threadId) {
        threadId = await createThread(ctx, components.agent, {
          userId: user._id,
          title: profile.title,
        })
        await ctx.db.patch(args.profileId, {
          threadId,
          updatedAt: Date.now(),
        })
      }

      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        userId: user._id,
        prompt: args.prompt,
      })

      await ctx.scheduler.runAfter(
        0,
        internal.modules.profile.nodeActions.runProfileAgent,
        {
          profileId: args.profileId,
          promptMessageId: messageId,
        },
      )

      // Set the busy flag last so a scheduling failure cannot leave it stuck.
      await ctx.db.patch(args.profileId, {
        agentRunningSince: Date.now(),
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error sending profile message', error)
      return { error: 'MESSAGE_SEND_FAILED' }
    }
  },
})

export const createDocument = mutation({
  args: {
    profileId: v.id('profiles'),
    kind: v.union(
      v.literal('resume'),
      v.literal('coverLetter'),
      v.literal('other'),
    ),
    title: v.string(),
    fileId: v.id('_storage'),
    fileName: v.string(),
    fileSize: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ documentId: Id<'documents'> } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    try {
      const documentId = await ctx.db.insert('documents', {
        userId: result.user._id,
        profileId: args.profileId,
        kind: args.kind,
        title: args.title,
        fileId: args.fileId,
        pdfFileId: null,
        fileName: args.fileName,
        fileSize: args.fileSize,
        rawText: '',
        status: 'processing',
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      await ctx.scheduler.runAfter(
        0,
        internal.modules.profile.nodeActions.extractDocumentText,
        { documentId },
      )

      return { documentId }
    } catch (error) {
      console.error('Error creating document', error)
      return { error: 'DOCUMENT_CREATE_FAILED' }
    }
  },
})

export const removeDocument = mutation({
  args: { documentId: v.id('documents') },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    const document = await getDocumentById(ctx, args.documentId)
    if (!document) {
      return { error: 'DOCUMENT_NOT_FOUND' }
    }

    if (document.userId !== user._id) {
      return { error: 'FORBIDDEN' }
    }

    try {
      await ctx.db.patch(args.documentId, {
        deleted: true,
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error deleting document', error)
      return { error: 'DOCUMENT_DELETE_FAILED' }
    }
  },
})

export const updateDocumentExtraction = internalMutation({
  args: {
    documentId: v.id('documents'),
    rawText: v.string(),
    status: v.union(v.literal('ready'), v.literal('error')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.documentId, {
      rawText: args.rawText,
      status: args.status,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    })
  },
})

export const updateDocumentPdfFileId = internalMutation({
  args: {
    documentId: v.id('documents'),
    pdfFileId: v.nullable(v.id('_storage')),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.documentId, {
      pdfFileId: args.pdfFileId,
      updatedAt: Date.now(),
    })
  },
})

export const updateDocumentRating = internalMutation({
  args: {
    documentId: v.id('documents'),
    rating: ratingValidator,
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.documentId, {
      rating: args.rating,
      updatedAt: Date.now(),
    })
  },
})

export const clearAgentRunning = internalMutation({
  args: { profileId: v.id('profiles') },
  handler: async (ctx, args): Promise<void> => {
    const profile = await ctx.db.get(args.profileId)
    if (!profile || profile.agentRunningSince === undefined) {
      return
    }

    await ctx.db.patch(args.profileId, {
      agentRunningSince: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const updateDataInternal = internalMutation({
  args: {
    profileId: v.id('profiles'),
    data: profileDataValidator,
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.data.header.links.length > MAX_HEADER_LINKS) {
      throw new Error('TOO_MANY_HEADER_LINKS')
    }

    await ctx.db.patch(args.profileId, {
      data: args.data,
      updatedAt: Date.now(),
    })
  },
})
