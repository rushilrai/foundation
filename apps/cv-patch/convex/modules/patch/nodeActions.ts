'use node'

import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import { internalAction } from '../../_generated/server'
import { DEFAULT_REASONING_EFFORT, setupOpenAI } from '../../configs/ai'
import { convertFileToPdf } from '../common/cloudconvert'
import { buildPatchSystem, createPatchAgent } from './agent'

// Mirrored in PatchChat.tsx, which hides this synthetic message.
const FIRST_RUN_PROMPT =
  'Research the company and role, curate my resume from my profile, and write a cover letter.'

export const startPatchAgent = internalAction({
  args: { patchId: v.id('patches') },
  handler: async (ctx, args): Promise<void> => {
    console.log('[startPatchAgent] Starting', { patchId: args.patchId })

    try {
      await setupOpenAI()

      const patch = await ctx.runQuery(
        internal.modules.patch.queries.getByIdInternal,
        { patchId: args.patchId },
      )

      if (!patch) {
        console.error('[startPatchAgent] Patch not found', {
          patchId: args.patchId,
        })
        return
      }

      if (!patch.threadId) {
        throw new Error('Patch has no thread')
      }

      const profile = await ctx.runQuery(
        internal.modules.profile.queries.getByIdInternal,
        { profileId: patch.profileId },
      )

      if (!profile) {
        throw new Error('Profile data not available')
      }

      const agent = createPatchAgent()
      const result = await agent.streamText(
        ctx,
        { threadId: patch.threadId, userId: patch.userId },
        {
          prompt: FIRST_RUN_PROMPT,
          system: buildPatchSystem(patch, profile),
          providerOptions: {
            openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
          },
        },
        { saveStreamDeltas: true },
      )
      await result.consumeStream()

      const updated = await ctx.runQuery(
        internal.modules.patch.queries.getByIdInternal,
        { patchId: args.patchId },
      )

      if (updated && updated.status === 'generating') {
        throw new Error('Agent finished without producing a resume version')
      }

      console.log('[startPatchAgent] Complete', { patchId: args.patchId })
    } catch (error) {
      console.error('[startPatchAgent] Error', error)

      await ctx.runMutation(internal.modules.patch.mutations.markError, {
        patchId: args.patchId,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Unknown error during patch generation',
      })
    } finally {
      await ctx.runMutation(
        internal.modules.patch.mutations.clearAgentRunning,
        { patchId: args.patchId },
      )
    }
  },
})

// Recovery for CloudConvert failures during agent runs.
export const backfillPdfs = internalAction({
  args: { patchId: v.id('patches') },
  handler: async (
    ctx,
    args,
  ): Promise<{ resumePdf: boolean; coverLetterPdf: boolean }> => {
    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByIdInternal,
      { patchId: args.patchId },
    )

    if (!patch) {
      throw new Error('Patch not found')
    }

    let resumePdf = false
    let coverLetterPdf = false

    if (patch.patchedFileId && !patch.pdfFileId) {
      const pdfFileId = await convertFileToPdf(
        ctx,
        patch.patchedFileId,
        'resume.docx',
      )
      await ctx.runMutation(
        internal.modules.patch.mutations.setBackfilledPdfs,
        {
          patchId: args.patchId,
          pdfFileId,
        },
      )
      resumePdf = true
    }

    if (patch.coverLetter && !patch.coverLetter.pdfFileId) {
      const coverLetterPdfFileId = await convertFileToPdf(
        ctx,
        patch.coverLetter.fileId,
        'cover-letter.docx',
      )
      await ctx.runMutation(
        internal.modules.patch.mutations.setBackfilledPdfs,
        {
          patchId: args.patchId,
          coverLetterPdfFileId,
        },
      )
      coverLetterPdf = true
    }

    return { resumePdf, coverLetterPdf }
  },
})

export const continuePatchAgent = internalAction({
  args: {
    patchId: v.id('patches'),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      await setupOpenAI()

      const patch = await ctx.runQuery(
        internal.modules.patch.queries.getByIdInternal,
        { patchId: args.patchId },
      )

      if (!patch?.threadId) {
        console.error('[continuePatchAgent] Patch or thread not found', {
          patchId: args.patchId,
        })
        return
      }

      const profile = await ctx.runQuery(
        internal.modules.profile.queries.getByIdInternal,
        { profileId: patch.profileId },
      )

      if (!profile) {
        console.error('[continuePatchAgent] Profile data not available', {
          patchId: args.patchId,
        })
        return
      }

      const agent = createPatchAgent()
      const result = await agent.streamText(
        ctx,
        { threadId: patch.threadId, userId: patch.userId },
        {
          promptMessageId: args.promptMessageId,
          system: buildPatchSystem(patch, profile),
          providerOptions: {
            openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
          },
        },
        { saveStreamDeltas: true },
      )
      await result.consumeStream()
    } catch (error) {
      // The thread keeps its history; the user can retry from the chat.
      console.error('[continuePatchAgent] Error', error)
    } finally {
      await ctx.runMutation(
        internal.modules.patch.mutations.clearAgentRunning,
        { patchId: args.patchId },
      )
    }
  },
})
