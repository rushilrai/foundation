import { createThread, saveMessage } from '@convex-dev/agent'
import { v } from 'convex/values'

import { components, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { internalMutation, mutation } from '../../_generated/server'
import { rateLimiter } from '../../configs/rateLimiter'
import { resumeDataValidator } from '../common/resumeData'
import { getById as getProfileById } from '../profile/helpers'
import { getByExternalId } from '../user/helpers'
import { getByIdWithAuth } from './helpers'

// A run older than this is considered crashed and no longer blocks new runs.
const AGENT_RUN_STALE_MS = 10 * 60 * 1000

const isAgentBusy = (agentRunningSince: number | undefined): boolean =>
  agentRunningSince !== undefined &&
  Date.now() - agentRunningSince < AGENT_RUN_STALE_MS

export const create = mutation({
  args: {
    profileId: v.id('profiles'),
    title: v.string(),
    jobDescription: v.string(),
    companyName: v.string(),
    roleName: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ patchId: Id<'patches'> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    const profile = await getProfileById(ctx, args.profileId)
    if (!profile) {
      return { error: 'PROFILE_NOT_FOUND' }
    }

    if (profile.userId !== user._id) {
      return { error: 'FORBIDDEN' }
    }

    // Tailoring needs facts to curate from.
    if (
      !profile.data.header.name.trim() ||
      (profile.data.experience.length === 0 &&
        profile.data.projects.length === 0)
    ) {
      return { error: 'PROFILE_EMPTY' }
    }

    const { ok } = await rateLimiter.limit(ctx, 'createPatch', {
      key: user._id,
    })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    try {
      const threadId = await createThread(ctx, components.agent, {
        userId: user._id,
        title: args.title,
      })

      const patchId = await ctx.db.insert('patches', {
        profileId: args.profileId,
        userId: user._id,
        title: args.title,
        jobDescription: args.jobDescription,
        companyName: args.companyName,
        roleName: args.roleName,
        threadId,
        agentRunningSince: Date.now(),
        templateId: 'resume-v1',
        data: null,
        patchedFileId: null,
        pdfFileId: null,
        changes: null,
        status: 'generating',
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      await ctx.scheduler.runAfter(
        0,
        internal.modules.patch.nodeActions.startPatchAgent,
        {
          patchId,
        },
      )

      return { patchId }
    } catch (error) {
      console.error('Error creating patch', error)
      return { error: 'PATCH_CREATE_FAILED' }
    }
  },
})

export const sendMessage = mutation({
  args: {
    patchId: v.id('patches'),
    // Client-only hint for the optimistic update; the server derives it.
    threadId: v.optional(v.string()),
    prompt: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.patchId)

    if ('error' in result) {
      return result
    }

    const { patch, user } = result

    if (!args.prompt.trim()) {
      return { error: 'EMPTY_MESSAGE' }
    }

    if (isAgentBusy(patch.agentRunningSince)) {
      return { error: 'AGENT_BUSY' }
    }

    const { ok } = await rateLimiter.limit(ctx, 'sendAgentMessage', {
      key: user._id,
    })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    try {
      let threadId = patch.threadId

      // Patches created before the agent flow get a thread on first message.
      if (!threadId) {
        threadId = await createThread(ctx, components.agent, {
          userId: user._id,
          title: patch.title,
        })
        await ctx.db.patch(args.patchId, {
          threadId,
          updatedAt: Date.now(),
        })
      }

      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId,
        userId: user._id,
        prompt: args.prompt,
      })

      await ctx.db.patch(args.patchId, {
        agentRunningSince: Date.now(),
        updatedAt: Date.now(),
      })

      await ctx.scheduler.runAfter(
        0,
        internal.modules.patch.nodeActions.continuePatchAgent,
        {
          patchId: args.patchId,
          promptMessageId: messageId,
        },
      )

      return { success: true }
    } catch (error) {
      console.error('Error sending patch message', error)
      return { error: 'MESSAGE_SEND_FAILED' }
    }
  },
})

export const restoreVersion = mutation({
  args: {
    patchId: v.id('patches'),
    versionId: v.id('patchVersions'),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.patchId)

    if ('error' in result) {
      return result
    }

    const version = await ctx.db.get(args.versionId)
    if (!version || version.patchId !== args.patchId) {
      return { error: 'VERSION_NOT_FOUND' }
    }

    if (isAgentBusy(result.patch.agentRunningSince)) {
      return { error: 'AGENT_BUSY' }
    }

    try {
      await ctx.db.patch(args.patchId, {
        data: version.data,
        changes: version.changes,
        patchedFileId: version.patchedFileId,
        pdfFileId: version.pdfFileId,
        activeVersionId: args.versionId,
        status: 'ready',
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error restoring patch version', error)
      return { error: 'VERSION_RESTORE_FAILED' }
    }
  },
})

export const remove = mutation({
  args: { patchId: v.id('patches') },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.patchId)

    if ('error' in result) {
      return result
    }

    try {
      await ctx.db.patch(args.patchId, {
        deleted: true,
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error deleting patch', error)
      return { error: 'PATCH_DELETE_FAILED' }
    }
  },
})

export const saveVersion = internalMutation({
  args: {
    patchId: v.id('patches'),
    data: resumeDataValidator,
    changes: v.array(v.string()),
    patchedFileId: v.id('_storage'),
    pdfFileId: v.nullable(v.id('_storage')),
    pageCount: v.nullable(v.number()),
  },
  handler: async (ctx, args): Promise<{ versionNumber: number }> => {
    const patch = await ctx.db.get(args.patchId)
    if (!patch) {
      throw new Error('Patch not found')
    }

    const latest = await ctx.db
      .query('patchVersions')
      .withIndex('by_patchId', (q) => q.eq('patchId', args.patchId))
      .order('desc')
      .first()

    let versionNumber = (latest?.versionNumber ?? 0) + 1

    // Snapshot pre-versioning output as v1 so it survives the overwrite.
    if (!latest && patch.data && patch.patchedFileId) {
      await ctx.db.insert('patchVersions', {
        patchId: args.patchId,
        userId: patch.userId,
        versionNumber: 1,
        data: patch.data,
        changes: patch.changes ?? [],
        patchedFileId: patch.patchedFileId,
        pdfFileId: patch.pdfFileId,
        pageCount: null,
        createdAt: patch.createdAt,
      })
      versionNumber = 2
    }

    const versionId = await ctx.db.insert('patchVersions', {
      patchId: args.patchId,
      userId: patch.userId,
      versionNumber,
      data: args.data,
      changes: args.changes,
      patchedFileId: args.patchedFileId,
      pdfFileId: args.pdfFileId,
      pageCount: args.pageCount,
      createdAt: Date.now(),
    })

    await ctx.db.patch(args.patchId, {
      data: args.data,
      changes: args.changes,
      patchedFileId: args.patchedFileId,
      pdfFileId: args.pdfFileId,
      activeVersionId: versionId,
      status: 'ready',
      errorMessage: undefined,
      updatedAt: Date.now(),
    })

    return { versionNumber }
  },
})

export const saveCoverLetter = internalMutation({
  args: {
    patchId: v.id('patches'),
    greeting: v.string(),
    paragraphs: v.array(v.string()),
    fileId: v.id('_storage'),
    pdfFileId: v.nullable(v.id('_storage')),
  },
  handler: async (ctx, args): Promise<void> => {
    const patch = await ctx.db.get(args.patchId)
    if (!patch) {
      throw new Error('Patch not found')
    }

    // Replace, don't accumulate: drop the previous letter's files.
    if (patch.coverLetter) {
      await ctx.storage.delete(patch.coverLetter.fileId)
      if (patch.coverLetter.pdfFileId) {
        await ctx.storage.delete(patch.coverLetter.pdfFileId)
      }
    }

    await ctx.db.patch(args.patchId, {
      coverLetter: {
        greeting: args.greeting,
        paragraphs: args.paragraphs,
        fileId: args.fileId,
        pdfFileId: args.pdfFileId,
        generatedAt: Date.now(),
      },
      updatedAt: Date.now(),
    })
  },
})

export const setBackfilledPdfs = internalMutation({
  args: {
    patchId: v.id('patches'),
    pdfFileId: v.optional(v.id('_storage')),
    coverLetterPdfFileId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args): Promise<void> => {
    const patch = await ctx.db.get(args.patchId)
    if (!patch) {
      throw new Error('Patch not found')
    }

    if (args.pdfFileId) {
      await ctx.db.patch(args.patchId, {
        pdfFileId: args.pdfFileId,
        updatedAt: Date.now(),
      })

      // Keep the active version row in sync so restores keep the PDF.
      if (patch.activeVersionId) {
        const version = await ctx.db.get(patch.activeVersionId)
        if (version && !version.pdfFileId) {
          await ctx.db.patch(patch.activeVersionId, {
            pdfFileId: args.pdfFileId,
          })
        }
      }
    }

    if (args.coverLetterPdfFileId && patch.coverLetter) {
      await ctx.db.patch(args.patchId, {
        coverLetter: {
          ...patch.coverLetter,
          pdfFileId: args.coverLetterPdfFileId,
        },
        updatedAt: Date.now(),
      })
    }
  },
})

export const markError = internalMutation({
  args: {
    patchId: v.id('patches'),
    errorMessage: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const patch = await ctx.db.get(args.patchId)
    if (!patch) {
      return
    }

    // Do not regress a patch that already has a usable version.
    if (patch.status === 'ready') {
      return
    }

    await ctx.db.patch(args.patchId, {
      status: 'error',
      errorMessage: args.errorMessage,
      agentRunningSince: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const clearAgentRunning = internalMutation({
  args: { patchId: v.id('patches') },
  handler: async (ctx, args): Promise<void> => {
    const patch = await ctx.db.get(args.patchId)
    if (!patch || patch.agentRunningSince === undefined) {
      return
    }

    await ctx.db.patch(args.patchId, {
      agentRunningSince: undefined,
      updatedAt: Date.now(),
    })
  },
})
