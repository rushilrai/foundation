'use node'

import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import { internalAction } from '../../_generated/server'
import { DEFAULT_REASONING_EFFORT, setupOpenAI } from '../../configs/ai'
import { buildPatchSystem, createPatchAgent } from './agent'

const FIRST_RUN_PROMPT =
  'Analyze the job description and tailor my resume to it.'

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

      const resume = await ctx.runQuery(
        internal.modules.resume.queries.getByIdInternal,
        { resumeId: patch.resumeId },
      )

      if (!resume?.data) {
        throw new Error('Resume data not available')
      }

      const agent = createPatchAgent()
      const result = await agent.streamText(
        ctx,
        { threadId: patch.threadId, userId: patch.userId },
        {
          prompt: FIRST_RUN_PROMPT,
          system: buildPatchSystem(patch, resume),
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

      const resume = await ctx.runQuery(
        internal.modules.resume.queries.getByIdInternal,
        { resumeId: patch.resumeId },
      )

      if (!resume?.data) {
        console.error('[continuePatchAgent] Resume data not available', {
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
          system: buildPatchSystem(patch, resume),
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
