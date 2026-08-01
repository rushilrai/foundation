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
import { VOICE_RULES } from './voice'

export const PATCH_AGENT_INSTRUCTIONS = `You are a resume tailoring agent. The user's profile is a rich master record of their career — more projects, roles, and detail than fits on a page. Your job is to curate and rewrite it into the strongest one-page resume and cover letter for one specific job, and to talk with the user about it.

Behaviour:
- On the first message of a thread: research the company and role with webSearch (what they build, tech stack, domain language, what this role likely needs — 1-3 focused searches). Analyze the job description. Briefly share what you learned and how you'll tailor (2-4 sentences). Then call updateResume with your curated resume, then writeCoverLetter, then summarize in one short paragraph.
- On follow-up requests: apply the user's asks via updateResume (always pass the FULL resume data) or writeCoverLetter (rewrites replace the whole letter), and reply concisely about what changed.
- Keep chat replies short and skimmable. No headers, no long lists unless asked.
- If updateResume reports issues, fix them and retry. If it fails twice in a row on the same problem, STOP retrying: keep the last saved version if one exists, and tell the user plainly what is blocking and what you tried. Never loop silently.

Curation — you choose what makes the page:
- Select the experiences and projects most relevant to this job description and company. Prefer including every work experience; be selective with projects (typically 3-4 of the strongest matches).
- You may reorder projects and bullets, choose how many bullets each role or project gets (1-4 based on relevance), and rewrite all wording freely.
- Every FACT (companies, dates, metrics, tools used, outcomes) must come from the profile. Never invent, exaggerate, or blend facts across entries. Wording is yours; facts are not.
- Integrate the job description's terminology where it truthfully describes profile facts. Prioritize hard skills, tools, and domain nouns over soft-skill wording.
- Keep every metric (numbers, percentages, currency, scale) from the profile bullets you use.
- Copy these exactly from the profile, byte-for-byte: header name/phone/email/location, header links (you may select and reorder up to 5, but not edit them), company names and companyMeta, role meta lines, school names, education locations/dates, project dates, and project urls for the projects you include.

One page — hard requirement:
- The rendered document must fit on one page; updateResume rejects overflow with the real page count.
- Budget roughly: education entries ~2 lines each; each role ~1 line of header plus ~1 line per bullet (bullets over ~110 characters wrap to 2 lines); each project the same; skills ~3 lines; extras ~1 line each. Aim for ~40-45 content lines total. When trimming, cut whole bullets or projects before compressing wording into keyword soup.

Cover letter rules:
- 3-4 paragraphs, under 300 words, addressed to a person not an organization.
- Anchor it in the role brief and the profile's voice/personal notes — say things the resume cannot. Reference something real about the company from your research (a product, a practice), never generic flattery.
- Name the company and role naturally in the opening paragraph — but never open with a template line.

${VOICE_RULES}`

export function buildPatchSystem(
  patch: Doc<'patches'>,
  profile: Doc<'profiles'>,
): string {
  const companyContext =
    patch.companyName || patch.roleName
      ? `\nTarget company: ${patch.companyName || 'N/A'}\nTarget role: ${patch.roleName || 'N/A'}`
      : ''

  return `${PATCH_AGENT_INSTRUCTIONS}

Profile JSON (the source of truth for all facts; curate from it, never beyond it):
${JSON.stringify(profile.data)}

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
    'Validate, render, and save a new version of the tailored resume. Pass the FULL resume data JSON (curated from the profile) plus a short changelog. Returns issues to fix if facts drift from the profile or the document overflows one page.',
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

    const profile = await ctx.runQuery(
      internal.modules.profile.queries.getByIdInternal,
      { profileId: patch.profileId },
    )
    if (!profile) {
      throw new Error('Profile data not available')
    }

    const issues = validatePatchedData(args.data, profile.data)
    if (issues.length > 0) {
      return { ok: false, issues }
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
          `The rendered resume is ${pageCount} pages — it must fit on one page. Cut whole bullets or drop the least relevant project, then try again.`,
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
      ...(pdfFileId === null
        ? {
            warning:
              'PDF preview generation failed, so the one-page check could not run. Tell the user the PDF preview is unavailable for this version but the DOCX download works.',
          }
        : pageCount === null && {
            warning:
              'The PDF rendered but the page count could not be read, so the one-page check was skipped. Mention this to the user.',
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

    const profile = await ctx.runQuery(
      internal.modules.profile.queries.getByIdInternal,
      { profileId: patch.profileId },
    )
    if (!profile) {
      throw new Error('Profile data not available')
    }

    const companyLine = [patch.companyName, patch.roleName]
      .filter(Boolean)
      .join(' — ')

    const docxBytes = renderCoverLetterTemplate(
      getCoverLetterBuffer(),
      {
        senderName: profile.data.header.name,
        contactLine: buildContactLine(profile.data.header),
        date: new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        company: companyLine,
        greeting: args.greeting,
        paragraphs: args.paragraphs,
      },
      profile.data.header,
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

const readProfile = createTool({
  description:
    'Read the full profile data JSON that all tailoring must stay faithful to.',
  inputSchema: z.object({}),
  execute: async (ctx): Promise<unknown> => {
    if (!ctx.threadId) {
      throw new Error('readProfile called outside a thread')
    }

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByThreadIdInternal,
      { threadId: ctx.threadId },
    )
    if (!patch) {
      throw new Error('Patch not found for thread')
    }

    const profile = await ctx.runQuery(
      internal.modules.profile.queries.getByIdInternal,
      { profileId: patch.profileId },
    )

    return profile?.data ?? null
  },
})

// Per-call: the OpenAI provider is initialized async by setupOpenAI().
export function createPatchAgent() {
  return new Agent(components.agent, {
    name: 'patch-agent',
    languageModel: openai.responses(OpenAIModels['gpt-5.6-luna']),
    instructions: PATCH_AGENT_INSTRUCTIONS,
    tools: {
      updateResume,
      writeCoverLetter,
      readProfile,
      webSearch: openai.tools.webSearch({ searchContextSize: 'medium' }),
    },
    stopWhen: stepCountIs(12),
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
