'use node'

import { generateText, Output } from 'ai'
import { v } from 'convex/values'
import JSZip from 'jszip'

import { internal } from '../../_generated/api'
import { internalAction } from '../../_generated/server'
import {
  MAX_HEADER_LINKS,
  ResumeDataSchema,
  type ResumeData,
} from '../../../shared/resumeSchema'
import { dropMissingSkillLinks } from '../../../shared/skillLinks'
import {
  DEFAULT_REASONING_EFFORT,
  openai,
  OpenAIModels,
  setupOpenAI,
} from '../../configs/ai'
import { convertDocxToPdf } from '../common/cloudconvert'
import { extractPlainText, parseHyperlinkTargets } from './docxText'

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
      const zip = await JSZip.loadAsync(arrayBuffer).catch(() => null)

      if (!zip) {
        await ctx.runMutation(
          internal.modules.resume.mutations.updateExtractedContent,
          {
            resumeId: args.resumeId,
            data: null,
            rawText: '',
            status: 'error',
            errorMessage: 'File is not a valid .docx document',
          },
        )
        return
      }

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

      const relsXml = await zip
        .file('word/_rels/document.xml.rels')
        ?.async('string')

      const rawText = extractPlainText(
        documentXml,
        parseHyperlinkTargets(relsXml ?? ''),
      )

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
6. Capture up to ${MAX_HEADER_LINKS} links from the contact/header area (LinkedIn, GitHub, portfolio, website, etc.) as header.links. label is the platform/site name. Hyperlink targets appear in parentheses after the linked text, e.g. "LinkedIn (https://linkedin.com/in/foo)" — use the URL in parentheses as url when present, otherwise the link text as written. Never use mailto:/tel: targets as links (email and phone are their own fields). Use an empty array when there are none.
7. For each project, set projects[].url to the hyperlink target on the project title — e.g. "Trading Engine (https://github.com/foo/engine)" gives name "Trading Engine" and url "https://github.com/foo/engine". Use an empty string when the project title has no link.
8. Each line of the SKILLS section written as "Label: value" becomes one skills entry, in order: label is the text before the first colon, exactly as written and without the colon (e.g. "Quantitative Methods", "Financial Systems & Tools", "Certifications"); value is the rest of the line, trimmed. links lists the hyperlinks inside the value, in order: text is the visible link text and url the parenthesized target — e.g. "Certifications: CFA Level I (https://cfa.org/cert) (Passed)" gives label "Certifications", value "CFA Level I (Passed)" and links [{ text: "CFA Level I", url: "https://cfa.org/cert" }]. Remove the "(https://…)" target from value. Use an empty links array when the line has no hyperlinks.
9. Parenthesized hyperlink targets may ONLY be used as header.links urls, projects[].url and skills[].links[].url — never copy the "(https://…)" text into names, bullets, degrees, skill values or any other field.
10. Capture the city/location from the contact/header area as header.location, exactly as written (e.g. "London" or "London, UK"). Use an empty string when there is none.
11. A tab in a line separates the left text from its right-aligned column (location | dates).
12. experience[].company is the company name exactly as written, including any trailing parenthetical (e.g. "Morgan Stanley (via Accolite)"). When the company line has a right-aligned column (after a tab), that text is experience[].companyMeta. When a role title line has a right-aligned column, that text is that role's meta. Use empty strings only when there is no such column. Every location/date on the page must end up in some field.
13. education[].details holds the lines under the degree line, one per line joined with "\\n", each exactly as written.
14. Output JSON only that matches the schema exactly.`

      const prompt = `Resume text:
${rawText}

Return JSON that matches this structure:
header: { name, phone, email, location, links: [{ label, url }] }
education: [{ school, location, dates, degree, details }]
experience: [{ company, companyMeta, roles: [{ title, meta, bullets[] }] }]
projects: [{ name, url, dates, bullets[] }]
skills: [{ label, value, links: [{ text, url }] }]
extras: string[]`

      const { output } = await generateText({
        model: openai.responses(OpenAIModels['gpt-5.6-luna']),
        output: Output.object({ schema: ResumeDataSchema }),
        system,
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
          system,
          prompt: `${prompt}\n\nFix these issues:\n${issues.join('\n')}`,
          providerOptions: {
            openai: { reasoningEffort: DEFAULT_REASONING_EFFORT },
          },
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

      // A skill link whose text is not in its value can never be rendered
      // and would fail every later patch, so drop it here.
      const skillLinks = dropMissingSkillLinks(data)
      if (skillLinks.dropped.length > 0) {
        console.warn('[extractResumeData] Dropped skill links not in value', {
          resumeId: args.resumeId,
          dropped: skillLinks.dropped,
        })
        data = skillLinks.data
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

      // Schedule PDF conversion (non-blocking)
      await ctx.scheduler.runAfter(
        0,
        internal.modules.resume.nodeActions.convertResumeToPdf,
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

      const pdfFileId = await convertDocxToPdf(ctx, resume.fileId)

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
