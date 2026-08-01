'use node'

import { generateText, Output } from 'ai'
import { v } from 'convex/values'
import JSZip from 'jszip'
import { z } from 'zod'

import { internal } from '../../_generated/api'
import { internalAction } from '../../_generated/server'
import {
  DEFAULT_REASONING_EFFORT,
  openai,
  OpenAIModels,
  setupOpenAI,
} from '../../configs/ai'
import { convertFileToPdf } from '../common/cloudconvert'
import {
  extractPlainText,
  getSourceKind,
  parseHyperlinkTargets,
} from '../common/textExtraction'
import { buildProfileSystem, createProfileAgent } from './agent'

const pdfTranscriptionSchema = z.object({
  rawText: z
    .string()
    .describe('Plain-text transcription of the document, one line per line'),
})

const PDF_TRANSCRIPTION_SYSTEM = `Transcribe the document into plain text.
- Preserve line structure and mark list items with a leading "• ".
- Where a visible URL or link target exists, include it in parentheses after the linked text, e.g. "GitHub (https://github.com/foo)".
- Output the transcription only — no commentary.`

export const extractDocumentText = internalAction({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args): Promise<void> => {
    try {
      const document = await ctx.runQuery(
        internal.modules.profile.queries.getDocumentByIdInternal,
        { documentId: args.documentId },
      )

      if (!document) {
        console.error('[extractDocumentText] Document not found', {
          documentId: args.documentId,
        })
        return
      }

      const fail = async (errorMessage: string) => {
        await ctx.runMutation(
          internal.modules.profile.mutations.updateDocumentExtraction,
          {
            documentId: args.documentId,
            rawText: '',
            status: 'error',
            errorMessage,
          },
        )
      }

      const kind = getSourceKind(document.fileName)
      if (!kind) {
        await fail(
          'Unsupported file type. Upload a .docx, .pdf, .tex, or .txt file.',
        )
        return
      }

      const fileBlob = await ctx.storage.get(document.fileId)
      if (!fileBlob) {
        await fail('File not found in storage')
        return
      }

      let rawText: string

      if (kind === 'pdf') {
        await setupOpenAI()
        const { output } = await generateText({
          model: openai.responses(OpenAIModels['gpt-5.6-luna']),
          output: Output.object({ schema: pdfTranscriptionSchema }),
          system: PDF_TRANSCRIPTION_SYSTEM,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'file' as const,
                  data: new Uint8Array(await fileBlob.arrayBuffer()),
                  mediaType: 'application/pdf',
                  filename: document.fileName,
                },
                { type: 'text' as const, text: 'Transcribe this document.' },
              ],
            },
          ],
          providerOptions: {
            openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
          },
        })

        if (!output) {
          throw new Error('LLM did not return output')
        }

        rawText = output.rawText
      } else if (kind === 'docx') {
        const zip = await JSZip.loadAsync(await fileBlob.arrayBuffer())
        const documentXml = await zip.file('word/document.xml')?.async('string')

        if (!documentXml) {
          await fail('Could not find document.xml in docx file')
          return
        }

        const relsXml = await zip
          .file('word/_rels/document.xml.rels')
          ?.async('string')

        rawText = extractPlainText(
          documentXml,
          parseHyperlinkTargets(relsXml ?? ''),
        )
      } else {
        rawText = await fileBlob.text()
      }

      if (!rawText.trim()) {
        await fail('No extractable text found in document')
        return
      }

      await ctx.runMutation(
        internal.modules.profile.mutations.updateDocumentExtraction,
        {
          documentId: args.documentId,
          rawText,
          status: 'ready',
          errorMessage: undefined,
        },
      )

      // PDF preview and rating are best-effort follow-ups; a scheduling failure
      // must not overwrite the ready status we just committed.
      try {
        await ctx.scheduler.runAfter(
          0,
          internal.modules.profile.nodeActions.convertDocumentToPdf,
          { documentId: args.documentId },
        )
        if (document.kind === 'resume') {
          await ctx.scheduler.runAfter(
            0,
            internal.modules.profile.nodeActions.rateDocument,
            { documentId: args.documentId },
          )
        }
      } catch (error) {
        console.error(
          '[extractDocumentText] Follow-up scheduling failed',
          error,
        )
      }
    } catch (error) {
      console.error('[extractDocumentText] Error', error)
      await ctx.runMutation(
        internal.modules.profile.mutations.updateDocumentExtraction,
        {
          documentId: args.documentId,
          rawText: '',
          status: 'error',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Unknown error during extraction',
        },
      )
    }
  },
})

export const convertDocumentToPdf = internalAction({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args): Promise<void> => {
    try {
      const document = await ctx.runQuery(
        internal.modules.profile.queries.getDocumentByIdInternal,
        { documentId: args.documentId },
      )

      if (!document) {
        console.error('[convertDocumentToPdf] Document not found', {
          documentId: args.documentId,
        })
        return
      }

      // PDF uploads are their own preview; no conversion needed.
      const pdfFileId =
        getSourceKind(document.fileName) === 'pdf'
          ? document.fileId
          : await convertFileToPdf(ctx, document.fileId, document.fileName)

      await ctx.runMutation(
        internal.modules.profile.mutations.updateDocumentPdfFileId,
        {
          documentId: args.documentId,
          pdfFileId,
        },
      )
    } catch (error) {
      console.error('[convertDocumentToPdf] Error (non-fatal)', error)
    }
  },
})

const ratingSchema = z.object({
  overall: z
    .number()
    .min(0)
    .max(100)
    .describe('Overall score out of 100, consistent with category scores'),
  categories: z.array(
    z.object({
      name: z.string(),
      score: z.number().min(1).max(10),
      comments: z.string().describe('1-2 sentences, specific to this resume'),
    }),
  ),
  suggestions: z
    .array(z.string())
    .describe('Concrete, actionable improvements, most impactful first'),
})

const RATING_SYSTEM = `You are a senior recruiter and resume coach. Rate the resume against this rubric, scoring each category 1-10:

1. Impact & Quantification — do bullets lead with outcomes, numbers, scale?
2. Clarity & Action Verbs — strong verbs, no filler, one idea per bullet?
3. ATS & Keywords — concrete skills/tools/domain nouns a parser and recruiter search for?
4. Structure & Consistency — dates, tense, formatting, section ordering?
5. Red Flags — gaps, vagueness, cliches, inconsistencies (10 = no red flags)?

Be specific — reference actual content. Suggestions must be concrete edits, not generic advice. Keep 3-6 suggestions.`

export const rateDocument = internalAction({
  args: { documentId: v.id('documents') },
  handler: async (ctx, args): Promise<void> => {
    try {
      await setupOpenAI()

      const document = await ctx.runQuery(
        internal.modules.profile.queries.getDocumentByIdInternal,
        { documentId: args.documentId },
      )

      if (!document || !document.rawText.trim()) {
        console.error('[rateDocument] Document text not available', {
          documentId: args.documentId,
        })
        return
      }

      const { output } = await generateText({
        model: openai.responses(OpenAIModels['gpt-5.6-luna']),
        output: Output.object({ schema: ratingSchema }),
        system: RATING_SYSTEM,
        prompt: `Resume plain text:\n${document.rawText}`,
        providerOptions: {
          openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
        },
      })

      if (!output) {
        throw new Error('LLM did not return output')
      }

      await ctx.runMutation(
        internal.modules.profile.mutations.updateDocumentRating,
        {
          documentId: args.documentId,
          rating: { ...output, ratedAt: Date.now() },
        },
      )
    } catch (error) {
      console.error('[rateDocument] Error (non-fatal)', error)
    }
  },
})

export const runProfileAgent = internalAction({
  args: {
    profileId: v.id('profiles'),
    promptMessageId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      await setupOpenAI()

      const profile = await ctx.runQuery(
        internal.modules.profile.queries.getByIdInternal,
        { profileId: args.profileId },
      )

      if (!profile?.threadId) {
        console.error('[runProfileAgent] Profile or thread not found', {
          profileId: args.profileId,
        })
        return
      }

      const documents = await ctx.runQuery(
        internal.modules.profile.queries.listDocumentsInternal,
        { profileId: args.profileId },
      )

      const agent = createProfileAgent()
      const result = await agent.streamText(
        ctx,
        { threadId: profile.threadId, userId: profile.userId },
        {
          promptMessageId: args.promptMessageId,
          system: buildProfileSystem(profile, documents),
          providerOptions: {
            openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
          },
        },
        { saveStreamDeltas: true },
      )
      await result.consumeStream()
    } catch (error) {
      // The thread keeps its history; the user can retry from the chat.
      console.error('[runProfileAgent] Error', error)
    } finally {
      await ctx.runMutation(
        internal.modules.profile.mutations.clearAgentRunning,
        { profileId: args.profileId },
      )
    }
  },
})
