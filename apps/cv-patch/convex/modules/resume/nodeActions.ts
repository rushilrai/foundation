'use node'

import { generateText, Output } from 'ai'
import { v } from 'convex/values'
import JSZip from 'jszip'
import { z } from 'zod'

import { internal } from '../../_generated/api'
import { internalAction } from '../../_generated/server'
import {
  MAX_HEADER_LINKS,
  ResumeDataSchema,
  type ResumeData,
} from '../../../shared/resumeSchema'
import {
  DEFAULT_REASONING_EFFORT,
  openai,
  OpenAIModels,
  setupOpenAI,
} from '../../configs/ai'
import { convertFileToPdf } from '../common/cloudconvert'

type SourceKind = 'docx' | 'pdf' | 'text'

function getSourceKind(fileName: string): SourceKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'tex' || ext === 'txt') return 'text'
  return null
}

const EXTRACTION_SYSTEM = `You are an expert resume parser. Convert the resume into JSON that strictly matches the schema provided.

Rules:
1. Do NOT invent facts. Use only content present in the resume.
2. Preserve the original meaning, order, and section structure as closely as possible.
3. Put bullets in arrays, and keep bullet order.
4. Keep section headings out of the data fields.
5. Use empty strings for missing fields; do not omit keys.
6. Capture up to ${MAX_HEADER_LINKS} links from the contact/header area (LinkedIn, GitHub, portfolio, website, etc.) as header.links. label is the platform/site name; url is the link text exactly as written in the resume. Use an empty array when there are none.
7. Output JSON only that matches the schema exactly.`

const STRUCTURE_HINT = `Return JSON that matches this structure:
header: { name, phone, email, links: [{ label, url }] }
education: [{ school, location, dates, degree, details }]
experience: [{ company, companyMeta, roles: [{ title, meta, bullets[] }] }]
projects: [{ name, dates, bullets[] }]
skills: { technical, financial, languages }
extras: string[]`

const pdfExtractionSchema = z.object({
  rawText: z
    .string()
    .describe('Plain-text transcription of the resume, one line per line'),
  data: ResumeDataSchema,
})

export const extractResumeData = internalAction({
  args: { resumeId: v.id('resumes') },
  handler: async (ctx, args): Promise<void> => {
    try {
      await setupOpenAI()

      const resume = await ctx.runQuery(
        internal.modules.resume.queries.getByIdInternal,
        {
          resumeId: args.resumeId,
        },
      )

      if (!resume) {
        console.error('[extractResumeData] Resume not found', {
          resumeId: args.resumeId,
        })
        return
      }

      const fail = async (errorMessage: string) => {
        await ctx.runMutation(
          internal.modules.resume.mutations.updateExtractedContent,
          {
            resumeId: args.resumeId,
            data: null,
            rawText: '',
            status: 'error',
            errorMessage,
          },
        )
      }

      const kind = getSourceKind(resume.fileName)
      if (!kind) {
        await fail(
          'Unsupported file type. Upload a .docx, .pdf, .tex, or .txt file.',
        )
        return
      }

      const fileBlob = await ctx.storage.get(resume.fileId)
      if (!fileBlob) {
        await fail('File not found in storage')
        return
      }

      let rawText: string
      let data: ResumeData

      if (kind === 'pdf') {
        const extracted = await extractFromPdf(
          await fileBlob.arrayBuffer(),
          resume.fileName,
        )
        rawText = extracted.rawText
        data = extracted.data
      } else {
        if (kind === 'docx') {
          const zip = await JSZip.loadAsync(await fileBlob.arrayBuffer())
          const documentXml = await zip
            .file('word/document.xml')
            ?.async('string')

          if (!documentXml) {
            await fail('Could not find document.xml in docx file')
            return
          }

          rawText = extractPlainText(documentXml)
        } else {
          rawText = await fileBlob.text()
        }

        if (!rawText.trim()) {
          await fail('No extractable text found in resume')
          return
        }

        data = await extractFromText(rawText)
      }

      const finalIssues = validateResumeData(data)
      if (finalIssues.length > 0) {
        throw new Error(
          `Resume data failed validation: ${finalIssues.join('; ')}`,
        )
      }

      await ctx.runMutation(
        internal.modules.resume.mutations.updateExtractedContent,
        {
          resumeId: args.resumeId,
          data,
          rawText,
          status: 'ready',
          errorMessage: undefined,
        },
      )

      // PDF preview and rating are best-effort follow-ups (non-blocking)
      await ctx.scheduler.runAfter(
        0,
        internal.modules.resume.nodeActions.convertResumeToPdf,
        { resumeId: args.resumeId },
      )
      await ctx.scheduler.runAfter(
        0,
        internal.modules.resume.nodeActions.rateResume,
        { resumeId: args.resumeId },
      )
    } catch (error) {
      console.error('[extractResumeData] Error', error)
      await ctx.runMutation(
        internal.modules.resume.mutations.updateExtractedContent,
        {
          resumeId: args.resumeId,
          data: null,
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

async function extractFromText(rawText: string): Promise<ResumeData> {
  const prompt = `Resume text:
${rawText}

${STRUCTURE_HINT}`

  const { output } = await generateText({
    model: openai.responses(OpenAIModels['gpt-5.6-luna']),
    output: Output.object({ schema: ResumeDataSchema }),
    system: EXTRACTION_SYSTEM,
    prompt,
    providerOptions: {
      openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
    },
  })

  if (!output) {
    throw new Error('LLM did not return output')
  }

  let data = output
  const issues = validateResumeData(data)

  if (issues.length > 0) {
    const { output: retryOutput } = await generateText({
      model: openai.responses(OpenAIModels['gpt-5.6-luna']),
      output: Output.object({ schema: ResumeDataSchema }),
      system: EXTRACTION_SYSTEM,
      prompt: `${prompt}\n\nFix these issues:\n${issues.join('\n')}`,
      providerOptions: {
        openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
      },
    })

    if (retryOutput) {
      data = retryOutput
    }
  }

  return data
}

async function extractFromPdf(
  arrayBuffer: ArrayBuffer,
  fileName: string,
): Promise<{ rawText: string; data: ResumeData }> {
  const filePart = {
    type: 'file' as const,
    data: new Uint8Array(arrayBuffer),
    mediaType: 'application/pdf',
    filename: fileName,
  }
  const basePrompt = `Transcribe this resume PDF into rawText (plain text, preserving line structure), then parse it.\n\n${STRUCTURE_HINT}`

  const run = async (promptText: string) => {
    const { output } = await generateText({
      model: openai.responses(OpenAIModels['gpt-5.6-luna']),
      output: Output.object({ schema: pdfExtractionSchema }),
      system: EXTRACTION_SYSTEM,
      messages: [
        {
          role: 'user',
          content: [filePart, { type: 'text' as const, text: promptText }],
        },
      ],
      providerOptions: {
        openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
      },
    })

    if (!output) {
      throw new Error('LLM did not return output')
    }

    return output
  }

  let result = await run(basePrompt)
  const issues = validateResumeData(result.data)

  if (issues.length > 0) {
    result = await run(
      `${basePrompt}\n\nFix these issues:\n${issues.join('\n')}`,
    )
  }

  return result
}

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

export const rateResume = internalAction({
  args: { resumeId: v.id('resumes') },
  handler: async (ctx, args): Promise<void> => {
    try {
      await setupOpenAI()

      const resume = await ctx.runQuery(
        internal.modules.resume.queries.getByIdInternal,
        { resumeId: args.resumeId },
      )

      if (!resume?.data) {
        console.error('[rateResume] Resume data not available', {
          resumeId: args.resumeId,
        })
        return
      }

      const { output } = await generateText({
        model: openai.responses(OpenAIModels['gpt-5.6-luna']),
        output: Output.object({ schema: ratingSchema }),
        system: RATING_SYSTEM,
        prompt: `Resume JSON:\n${JSON.stringify(resume.data)}${
          resume.rawText.trim()
            ? `\n\nResume plain text (for formatting/consistency checks):\n${resume.rawText}`
            : ''
        }`,
        providerOptions: {
          openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
        },
      })

      if (!output) {
        throw new Error('LLM did not return output')
      }

      await ctx.runMutation(internal.modules.resume.mutations.updateRating, {
        resumeId: args.resumeId,
        rating: { ...output, ratedAt: Date.now() },
      })

      console.log('[rateResume] Complete', { resumeId: args.resumeId })
    } catch (error) {
      console.error('[rateResume] Error (non-fatal)', error)
    }
  },
})

function extractPlainText(xml: string): string {
  const paragraphs: Array<string> = []
  const paragraphRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
  let match: RegExpExecArray | null

  while ((match = paragraphRegex.exec(xml)) !== null) {
    const paragraphXml = match[0]
    const isBullet = /<w:numPr\b/.test(paragraphXml)
    const text = extractTextFromParagraph(paragraphXml)
    const cleaned = normalizeWhitespace(text)
    if (!cleaned) {
      continue
    }
    paragraphs.push(isBullet ? `• ${cleaned}` : cleaned)
  }

  return paragraphs.join('\n')
}

function extractTextFromParagraph(paragraphXml: string): string {
  const normalized = paragraphXml
    .replace(/<w:tab[^>]*\/>/g, '<w:t>\t</w:t>')
    .replace(/<w:br[^>]*\/>/g, '<w:t>\n</w:t>')
  const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
  const parts: Array<string> = []
  let match: RegExpExecArray | null

  while ((match = textRegex.exec(normalized)) !== null) {
    parts.push(decodeXml(match[1]))
  }

  return parts.join('')
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, num) =>
      String.fromCodePoint(parseInt(num, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export const convertResumeToPdf = internalAction({
  args: { resumeId: v.id('resumes') },
  handler: async (ctx, args): Promise<void> => {
    try {
      const resume = await ctx.runQuery(
        internal.modules.resume.queries.getByIdInternal,
        { resumeId: args.resumeId },
      )

      if (!resume) {
        console.error('[convertResumeToPdf] Resume not found', {
          resumeId: args.resumeId,
        })
        return
      }

      // PDF uploads are their own preview; no conversion needed.
      const pdfFileId =
        getSourceKind(resume.fileName) === 'pdf'
          ? resume.fileId
          : await convertFileToPdf(ctx, resume.fileId, resume.fileName)

      await ctx.runMutation(internal.modules.resume.mutations.updatePdfFileId, {
        resumeId: args.resumeId,
        pdfFileId,
      })

      console.log('[convertResumeToPdf] Complete', {
        resumeId: args.resumeId,
      })
    } catch (error) {
      console.error('[convertResumeToPdf] Error (non-fatal)', error)
    }
  },
})

function validateResumeData(data: ResumeData): Array<string> {
  const issues: Array<string> = []
  if (!data.header.name.trim()) issues.push('header.name is empty')
  if (!data.header.email.trim()) issues.push('header.email is empty')
  if (!data.header.phone.trim()) issues.push('header.phone is empty')
  if (data.header.links.length > MAX_HEADER_LINKS) {
    issues.push(`header.links has more than ${MAX_HEADER_LINKS} entries`)
  }
  return issues
}
