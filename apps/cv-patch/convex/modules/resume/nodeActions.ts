'use node'

import { OpenAIModels, openai, setupOpenAI } from '@convex/configs/ai'
import { Output, generateText } from 'ai'
import { internal } from 'convex/_generated/api'
import { internalAction } from 'convex/_generated/server'
import { v } from 'convex/values'
import JSZip from 'jszip'

import {  ResumeDataSchema } from '../../../shared/resumeSchema'
import type {ResumeData} from '../../../shared/resumeSchema';

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

      const fileBlob = await ctx.storage.get(resume.fileId)
      if (!fileBlob) {
        await ctx.runMutation(
          internal.modules.resume.mutations.updateExtractedContent,
          {
            resumeId: args.resumeId,
            data: null,
            rawText: '',
            status: 'error',
            errorMessage: 'File not found in storage',
          },
        )
        return
      }

      const arrayBuffer = await fileBlob.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      const documentXml = await zip.file('word/document.xml')?.async('string')

      if (!documentXml) {
        await ctx.runMutation(
          internal.modules.resume.mutations.updateExtractedContent,
          {
            resumeId: args.resumeId,
            data: null,
            rawText: '',
            status: 'error',
            errorMessage: 'Could not find document.xml in docx file',
          },
        )
        return
      }

      const rawText = extractPlainText(documentXml)

      if (!rawText.trim()) {
        await ctx.runMutation(
          internal.modules.resume.mutations.updateExtractedContent,
          {
            resumeId: args.resumeId,
            data: null,
            rawText: '',
            status: 'error',
            errorMessage: 'No extractable text found in resume',
          },
        )
        return
      }

      const system = `You are an expert resume parser. Convert the resume text into JSON that strictly matches the schema provided.

Rules:
1. Do NOT invent facts. Use only content present in the resume text.
2. Preserve the original meaning, order, and section structure as closely as possible.
3. Put bullets in arrays, and keep bullet order.
4. Keep section headings out of the data fields.
5. Use empty strings for missing fields; do not omit keys.
6. Output JSON only that matches the schema exactly.`

      const prompt = `Resume text:
${rawText}

Return JSON that matches this structure:
header: { name, phone, email, linkedin }
education: [{ school, location, dates, degree, details }]
experience: [{ company, companyMeta, roles: [{ title, meta, bullets[] }] }]
projects: [{ name, dates, bullets[] }]
skills: { technical, financial, languages }
extras: string[]`

      const { output } = await generateText({
        model: openai.responses(OpenAIModels['gpt-5.2']),
        output: Output.object({ schema: ResumeDataSchema }),
        system,
        prompt,
      })

      if (!output) {
        throw new Error('LLM did not return output')
      }

      let data = output
      const issues = validateResumeData(data)

      if (issues.length > 0) {
        const { output: retryOutput } = await generateText({
          model: openai.responses(OpenAIModels['gpt-5.2']),
          output: Output.object({ schema: ResumeDataSchema }),
          system,
          prompt: `${prompt}\n\nFix these issues:\n${issues.join('\n')}`,
        })

        if (retryOutput) {
          data = retryOutput
        }
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

function validateResumeData(data: ResumeData): Array<string> {
  const issues: Array<string> = []
  if (!data.header.name.trim()) issues.push('header.name is empty')
  if (!data.header.email.trim()) issues.push('header.email is empty')
  if (!data.header.phone.trim()) issues.push('header.phone is empty')
  if (!data.header.linkedin.trim()) issues.push('header.linkedin is empty')
  return issues
}
