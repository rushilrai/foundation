'use node'

import { Agent, createTool } from '@convex-dev/agent'
import { stepCountIs } from 'ai'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'

import { components, internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { ResumeDataSchema } from '../../../shared/resumeSchema'
import { decodeCoverLetterTemplate } from '../../assets/coverLetterTemplateData'
import { decodeBase64Template } from '../../assets/resumeTemplateData'
import { openai, OpenAIModels } from '../../configs/ai'
import { convertFileToPdf } from '../common/cloudconvert'
import {
  buildContactLine,
  renderCoverLetterTemplate,
  renderResumeTemplate,
} from './docxTemplate'
import { validatePatchedData } from './validation'

export const PATCH_AGENT_INSTRUCTIONS = `You are a resume tailoring assistant. You help the user adapt their base resume to a specific job description through conversation, and you deliver updated resume documents with the updateResume tool.

Behaviour:
- On the first message of a thread: briefly analyze the job description (key hard skills, tools, domain terminology, seniority signals), explain in a short plan how you will reword the resume, then call updateResume with your first tailored pass, then call writeCoverLetter with a tailored cover letter, then summarize what you did in one short paragraph.
- On follow-up requests: apply the user's asks via updateResume (always pass the FULL resume data, not a fragment) or writeCoverLetter (rewrites replace the whole letter), and reply concisely about what changed.
- The JSON you pass to updateResume must already contain the reworded text. Never submit the base resume unchanged — describing changes in the changelog without making them in the data is a failure.
- Keep chat replies short and skimmable. No headers, no long lists unless asked.
- If updateResume reports issues, fix them and call it again. Do not report failure to the user unless you cannot resolve the issues after a few attempts.

Cover letter rules:
- 3-4 paragraphs, under 300 words total, professional but not stiff.
- Ground every claim in facts from the base resume; never invent experience.
- Mirror the JD's terminology naturally; name the company and role in the opening paragraph.

Editing rules — in-place rewording only:
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
- projects[].dates

Editable fields — rewrite for ATS keyword alignment while preserving approximate character length:
- experience[].roles[].title — only adjust if the JD uses a clearly equivalent title; keep length within ~80%-125% of original
- experience[].roles[].bullets[] — substitute keywords, keep each bullet within ~80%-100% of original character count
- education[].degree, education[].details — keyword-focused rewrites within ~80%-100% of original length
- projects[].name — keyword-focused rewrite within ~80%-100% of original length
- projects[].bullets[] — same rules as experience bullets
- skills.technical, skills.financial, skills.languages — reorder to front-load JD-relevant terms, may substitute equivalent terms
- extras[] — preserve as-is unless directly relevant; if edited keep length within ~80%-100% of original

Structural invariants:
- Same number of experience entries, same number of roles per experience entry, same number of bullets per role.
- Same number of education entries, project entries, and extras entries.

The rendered document must fit on one page — updateResume rejects output that overflows.`

export function buildPatchSystem(
  patch: Doc<'patches'>,
  resume: Doc<'resumes'>,
): string {
  const companyContext =
    patch.companyName || patch.roleName
      ? `\nTarget company: ${patch.companyName || 'N/A'}\nTarget role: ${patch.roleName || 'N/A'}\nLeverage domain-specific language and terminology from this company/industry where it naturally fits.`
      : ''

  return `${PATCH_AGENT_INSTRUCTIONS}

Base resume JSON (the immutable source of truth for facts and structure):
${JSON.stringify(resume.data)}

Job description:
${patch.jobDescription}
${companyContext}`
}

type UpdateResumeResult =
  | {
      ok: true
      versionNumber: number
      pageCount: number | null
      warning?: string
    }
  | { ok: false; issues: Array<string> }

const updateResume = createTool({
  description:
    'Validate, render, and save a new version of the tailored resume. Pass the FULL resume data JSON (matching the base resume structure exactly) plus a short changelog. Returns validation issues to fix if the data breaks the tailoring rules or overflows one page.',
  inputSchema: z.object({
    data: ResumeDataSchema,
    changes: z
      .array(z.string())
      .describe('Short bullet list of what changed and why'),
  }),
  execute: async (ctx, args): Promise<UpdateResumeResult> => {
    if (!ctx.threadId) {
      throw new Error('updateResume called outside a thread')
    }

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByThreadIdInternal,
      { threadId: ctx.threadId },
    )
    if (!patch) {
      throw new Error('Patch not found for thread')
    }

    const resume = await ctx.runQuery(
      internal.modules.resume.queries.getByIdInternal,
      { resumeId: patch.resumeId },
    )
    if (!resume?.data) {
      throw new Error('Base resume data not available')
    }

    const issues = validatePatchedData(args.data, resume.data)
    if (issues.length > 0) {
      return { ok: false, issues }
    }

    // A byte-identical echo of the base resume passes every constraint but
    // delivers nothing — reject it so the agent actually rewords.
    if (stableStringify(args.data) === stableStringify(resume.data)) {
      return {
        ok: false,
        issues: [
          'The submitted data is identical to the base resume. Apply the actual keyword rewording (bullets, titles, skills ordering) in the JSON you submit — do not re-send the base resume unchanged.',
        ],
      }
    }

    const docxBytes = renderResumeTemplate(getTemplateBuffer(), args.data)
    const patchedFileId = await ctx.storage.store(
      new Blob([toArrayBuffer(docxBytes)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )

    let pdfFileId: Doc<'patchVersions'>['pdfFileId'] = null
    let pageCount: number | null = null
    try {
      pdfFileId = await convertFileToPdf(ctx, patchedFileId, 'resume.docx')
      pageCount = await countPdfPages(ctx, pdfFileId)
    } catch (error) {
      // PDF preview is best-effort; the DOCX is still valid without it.
      console.error('[updateResume] PDF conversion failed (non-fatal)', error)
    }

    if (pageCount !== null && pageCount > 1) {
      await ctx.storage.delete(patchedFileId)
      if (pdfFileId) {
        await ctx.storage.delete(pdfFileId)
      }
      return {
        ok: false,
        issues: [
          `The rendered resume is ${pageCount} pages — it must fit on one page. Tighten the wording (shorten the longest bullets) and try again.`,
        ],
      }
    }

    let versionNumber: number
    try {
      const saved = await ctx.runMutation(
        internal.modules.patch.mutations.saveVersion,
        {
          patchId: patch._id,
          data: args.data,
          changes: args.changes,
          patchedFileId,
          pdfFileId,
          pageCount,
        },
      )
      versionNumber = saved.versionNumber
    } catch (error) {
      await ctx.storage.delete(patchedFileId)
      if (pdfFileId) {
        await ctx.storage.delete(pdfFileId)
      }
      throw error
    }

    return {
      ok: true,
      versionNumber,
      pageCount,
      ...(pageCount === null && {
        warning:
          'PDF preview generation failed, so the one-page check could not run. Tell the user the PDF preview is unavailable for this version but the DOCX download works.',
      }),
    }
  },
})

type WriteCoverLetterResult = { ok: true; warning?: string }

const writeCoverLetter = createTool({
  description:
    'Write (or fully rewrite) the cover letter for this application. Renders it into a DOCX with the sender details, date, and company filled in automatically — only provide the greeting and body paragraphs.',
  inputSchema: z.object({
    greeting: z
      .string()
      .describe('Salutation line, e.g. "Dear Hiring Manager,"'),
    paragraphs: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe('Body paragraphs, without the closing sign-off'),
  }),
  execute: async (ctx, args): Promise<WriteCoverLetterResult> => {
    if (!ctx.threadId) {
      throw new Error('writeCoverLetter called outside a thread')
    }

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByThreadIdInternal,
      { threadId: ctx.threadId },
    )
    if (!patch) {
      throw new Error('Patch not found for thread')
    }

    const resume = await ctx.runQuery(
      internal.modules.resume.queries.getByIdInternal,
      { resumeId: patch.resumeId },
    )
    if (!resume?.data) {
      throw new Error('Base resume data not available')
    }

    const companyLine = [patch.companyName, patch.roleName]
      .filter(Boolean)
      .join(' — ')

    const docxBytes = renderCoverLetterTemplate(
      getCoverLetterBuffer(),
      {
        senderName: resume.data.header.name,
        contactLine: buildContactLine(resume.data.header),
        date: new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        company: companyLine,
        greeting: args.greeting,
        paragraphs: args.paragraphs,
      },
      resume.data.header,
    )

    const fileId = await ctx.storage.store(
      new Blob([toArrayBuffer(docxBytes)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    )

    let pdfFileId: Doc<'patchVersions'>['pdfFileId'] = null
    try {
      pdfFileId = await convertFileToPdf(ctx, fileId, 'cover-letter.docx')
    } catch (error) {
      console.error(
        '[writeCoverLetter] PDF conversion failed (non-fatal)',
        error,
      )
    }

    try {
      await ctx.runMutation(internal.modules.patch.mutations.saveCoverLetter, {
        patchId: patch._id,
        greeting: args.greeting,
        paragraphs: args.paragraphs,
        fileId,
        pdfFileId,
      })
    } catch (error) {
      await ctx.storage.delete(fileId)
      if (pdfFileId) {
        await ctx.storage.delete(pdfFileId)
      }
      throw error
    }

    return {
      ok: true,
      ...(pdfFileId === null && {
        warning:
          'PDF export failed for the cover letter. Tell the user the PDF download is unavailable but the DOCX download works.',
      }),
    }
  },
})

const readBaseResume = createTool({
  description:
    'Read the base (original) resume data JSON that all tailoring must stay faithful to.',
  inputSchema: z.object({}),
  execute: async (ctx): Promise<unknown> => {
    if (!ctx.threadId) {
      throw new Error('readBaseResume called outside a thread')
    }

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByThreadIdInternal,
      { threadId: ctx.threadId },
    )
    if (!patch) {
      throw new Error('Patch not found for thread')
    }

    const resume = await ctx.runQuery(
      internal.modules.resume.queries.getByIdInternal,
      { resumeId: patch.resumeId },
    )

    return resume?.data ?? null
  },
})

// The agent is created per-call because the OpenAI provider is initialized
// asynchronously via setupOpenAI().
export function createPatchAgent() {
  return new Agent(components.agent, {
    name: 'patch-agent',
    languageModel: openai.responses(OpenAIModels['gpt-5.6-luna']),
    instructions: PATCH_AGENT_INSTRUCTIONS,
    tools: { updateResume, writeCoverLetter, readBaseResume },
    stopWhen: stepCountIs(10),
  })
}

let cachedTemplate: Uint8Array | null = null
let cachedCoverLetterTemplate: Uint8Array | null = null

function getTemplateBuffer(): Uint8Array {
  if (cachedTemplate) {
    return cachedTemplate
  }

  cachedTemplate = decodeBase64Template()
  return cachedTemplate
}

function getCoverLetterBuffer(): Uint8Array {
  if (cachedCoverLetterTemplate) {
    return cachedCoverLetterTemplate
  }

  cachedCoverLetterTemplate = decodeCoverLetterTemplate()
  return cachedCoverLetterTemplate
}

async function countPdfPages(
  ctx: {
    storage: {
      get: (id: Doc<'patchVersions'>['patchedFileId']) => Promise<Blob | null>
    }
  },
  pdfFileId: Doc<'patchVersions'>['patchedFileId'],
): Promise<number | null> {
  const blob = await ctx.storage.get(pdfFileId)
  if (!blob) {
    return null
  }

  const pdf = await PDFDocument.load(await blob.arrayBuffer(), {
    ignoreEncryption: true,
  })
  return pdf.getPageCount()
}

// JSON.stringify with sorted object keys, so semantically-equal payloads
// compare equal regardless of key order.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
