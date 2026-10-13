'use node'

import { generateText, Output } from 'ai'
import { v } from 'convex/values'
import { z } from 'zod'

import { internal } from '../../_generated/api'
import { internalAction } from '../../_generated/server'
import { ResumeDataSchema } from '../../../shared/resumeSchema'
import { decodeBase64Template } from '../../assets/resumeTemplateData'
import {
  DEFAULT_REASONING_EFFORT,
  openai,
  OpenAIModels,
  setupOpenAI,
} from '../../configs/ai'
import { convertDocxToPdf } from '../common/cloudconvert'
import { renderResumeTemplate } from './docxTemplate'
import { validatePatchedData } from './validation'

const patchOutputSchema = z.object({
  data: ResumeDataSchema,
  changes: z.array(z.string()),
})

export const generatePatch = internalAction({
  args: { patchId: v.id('patches') },
  handler: async (ctx, args): Promise<void> => {
    console.log('[generatePatch] Starting', { patchId: args.patchId })

    try {
      await setupOpenAI()

      const patch = await ctx.runQuery(
        internal.modules.patch.queries.getByIdInternal,
        {
          patchId: args.patchId,
        },
      )

      if (!patch) {
        console.error('[generatePatch] Patch not found', {
          patchId: args.patchId,
        })
        return
      }

      const resume = await ctx.runQuery(
        internal.modules.resume.queries.getByIdInternal,
        {
          resumeId: patch.resumeId,
        },
      )

      if (!resume) {
        await ctx.runMutation(
          internal.modules.patch.mutations.updateGeneratedContent,
          {
            patchId: args.patchId,
            patchedFileId: null,
            data: null,
            changes: null,
            status: 'error',
            errorMessage: 'Resume not found',
          },
        )
        return
      }

      if (!resume.data) {
        await ctx.runMutation(
          internal.modules.patch.mutations.updateGeneratedContent,
          {
            patchId: args.patchId,
            patchedFileId: null,
            data: null,
            changes: null,
            status: 'error',
            errorMessage: 'Resume data not available',
          },
        )
        return
      }

      await ctx.runMutation(
        internal.modules.patch.mutations.updateStreamingText,
        {
          patchId: args.patchId,
          streamingText: 'Analyzing resume and job description...',
        },
      )

      const system = `You are an expert resume editor and ATS optimizer performing in-place keyword optimization on a structured resume JSON.

CRITICAL CONSTRAINT: The output renders into a fixed-layout DOCX template. Keep all rewritten text within tight character bounds so the document layout remains stable.

Strategy — in-place rewriting:
- Maximize match quality for both ATS keyword matching and LLM-assisted recruiter screening.
- Integrate exact JD terminology where it naturally fits the original accomplishment.
- Add relevant lexical variants (abbreviations, expanded forms, adjacent domain phrasing) when factual meaning stays the same.
- Prioritize hard skills, tools, domain nouns, and scope/impact language over generic soft-skill wording.
- Do NOT invent facts, restructure sentences, add new bullets, remove bullets, or add/remove entries.
- Do NOT reorder bullets.
- You MAY reorder items within the skills fields (technical, financial, languages) to prioritize JD-relevant skills first.
- Preserve quantitative evidence: if a bullet contains numbers/percentages/currency/scale tokens, keep those metrics in the rewritten bullet.

Immutable fields — copy these exactly, byte-for-byte:
- header.name, header.phone, header.email, header.location, header.links (every label and url)
- experience[].company, experience[].companyMeta
- experience[].roles[].meta
- education[].school, education[].location, education[].dates
- projects[].name, projects[].url, projects[].dates (the project name is the hyperlink text — never rewrite it)

Editable fields — rewrite for ATS keyword alignment while preserving approximate character length:
- experience[].roles[].title — only adjust if the JD uses a clearly equivalent title; keep length within ~80%-125% of original
- experience[].roles[].bullets[] — substitute keywords, keep each bullet within ~80%-100% of original character count
- education[].degree, education[].details — keyword-focused rewrites within ~80%-100% of original length
- projects[].bullets[] — same rules as experience bullets
- skills.technical, skills.financial, skills.languages — reorder to front-load JD-relevant terms, may substitute equivalent terms
- extras[] — preserve as-is unless directly relevant; if edited keep length within ~80%-100% of original

Structural invariants:
- Same number of experience entries, same number of roles per experience entry, same number of bullets per role.
- Same number of education entries, project entries, and extras entries.

Output JSON that strictly matches the schema.`

      const companyContext =
        patch.companyName || patch.roleName
          ? `\nTarget company: ${patch.companyName || 'N/A'}\nTarget role: ${patch.roleName || 'N/A'}\nLeverage domain-specific language and terminology from this company/industry where it naturally fits.`
          : ''

      const prompt = `Base resume JSON:
${JSON.stringify(resume.data)}

Job description:
${patch.jobDescription}
${companyContext}

Return JSON with:
- data: the updated ResumeData JSON (must match schema exactly)
- changes: short bullet list of what you changed and why`

      const { output } = await generateText({
        model: openai.responses(OpenAIModels['gpt-5.6-luna']),
        output: Output.object({ schema: patchOutputSchema }),
        system,
        prompt,
        providerOptions: {
          openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
        },
      })

      let data = output.data
      let changes = output.changes

      let validationIssues = validatePatchedData(data, resume.data)
      for (
        let attempt = 1;
        validationIssues.length > 0 && attempt <= MAX_VALIDATION_RETRY_ATTEMPTS;
        attempt++
      ) {
        await ctx.runMutation(
          internal.modules.patch.mutations.updateStreamingText,
          {
            patchId: args.patchId,
            streamingText: `QA detected issues. Refining output (${attempt}/${MAX_VALIDATION_RETRY_ATTEMPTS})...`,
          },
        )

        const retryPrompt = `${prompt}

Your previous output:
${JSON.stringify(data)}

The following validation issues were found in your previous output. Fix ONLY these issues and return the corrected JSON:
${validationIssues.join('\n')}`

        const { output: retryOutput } = await generateText({
          model: openai.responses(OpenAIModels['gpt-5.6-luna']),
          output: Output.object({ schema: patchOutputSchema }),
          system,
          prompt: retryPrompt,
          providerOptions: {
            openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
          },
        })

        data = retryOutput.data
        changes = mergeChanges(changes, retryOutput.changes)
        validationIssues = validatePatchedData(data, resume.data)
      }

      if (validationIssues.length > 0) {
        throw new Error(
          `Patched resume failed validation: ${validationIssues.join('; ')}`,
        )
      }

      const templateBuffer = getTemplateBuffer()
      const docxBytes = renderResumeTemplate(templateBuffer, data)
      const docxBuffer = toArrayBuffer(docxBytes)

      const patchedFileId = await ctx.storage.store(
        new Blob([docxBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      )

      await ctx.runMutation(
        internal.modules.patch.mutations.updateGeneratedContent,
        {
          patchId: args.patchId,
          patchedFileId,
          data,
          changes,
          status: 'ready',
          errorMessage: undefined,
        },
      )

      // Schedule PDF conversion (non-blocking)
      await ctx.scheduler.runAfter(
        0,
        internal.modules.patch.nodeActions.convertPatchToPdf,
        { patchId: args.patchId },
      )

      console.log('[generatePatch] Complete', { patchId: args.patchId })
    } catch (error) {
      console.error('[generatePatch] Error', error)

      await ctx.runMutation(
        internal.modules.patch.mutations.updateGeneratedContent,
        {
          patchId: args.patchId,
          patchedFileId: null,
          data: null,
          changes: null,
          status: 'error',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'Unknown error during patch generation',
        },
      )
    }
  },
})

let cachedTemplate: Uint8Array | null = null
const MAX_VALIDATION_RETRY_ATTEMPTS = 3

function getTemplateBuffer(): Uint8Array {
  if (cachedTemplate) {
    return cachedTemplate
  }

  cachedTemplate = decodeBase64Template()
  return cachedTemplate
}

function mergeChanges(
  primary?: Array<string>,
  secondary?: Array<string>,
): Array<string> {
  const merged = new Set<string>()
  for (const change of primary ?? []) {
    merged.add(change)
  }
  for (const change of secondary ?? []) {
    merged.add(change)
  }
  return Array.from(merged)
}

export const convertPatchToPdf = internalAction({
  args: { patchId: v.id('patches') },
  handler: async (ctx, args): Promise<void> => {
    try {
      const patch = await ctx.runQuery(
        internal.modules.patch.queries.getByIdInternal,
        { patchId: args.patchId },
      )

      if (!patch) {
        console.error('[convertPatchToPdf] Patch not found', {
          patchId: args.patchId,
        })
        return
      }

      if (!patch.patchedFileId) {
        console.error('[convertPatchToPdf] No patchedFileId on patch', {
          patchId: args.patchId,
        })
        return
      }

      const pdfFileId = await convertDocxToPdf(ctx, patch.patchedFileId)

      await ctx.runMutation(internal.modules.patch.mutations.updatePdfFileId, {
        patchId: args.patchId,
        pdfFileId,
      })

      console.log('[convertPatchToPdf] Complete', {
        patchId: args.patchId,
      })
    } catch (error) {
      console.error('[convertPatchToPdf] Error (non-fatal)', error)
    }
  },
})

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
