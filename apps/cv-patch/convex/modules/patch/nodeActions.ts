'use node'

import { OpenAIModels, openai, setupOpenAI } from '@convex/configs/ai'
import { Output, generateText } from 'ai'
import { internal } from 'convex/_generated/api'
import { internalAction } from 'convex/_generated/server'
import { v } from 'convex/values'
import { z } from 'zod'

import { decodeBase64Template } from '../../assets/resumeTemplateData'
import { ResumeDataSchema } from '../../../shared/resumeSchema'
import { convertDocxToPdf } from '../common/cloudconvert'
import { renderResumeTemplate } from './docxTemplate'
import type { ResumeData } from '../../../shared/resumeSchema'

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
- header.name, header.phone, header.email, header.linkedin
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
        model: openai.responses(OpenAIModels['gpt-5.2']),
        output: Output.object({ schema: patchOutputSchema }),
        system,
        prompt,
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
          model: openai.responses(OpenAIModels['gpt-5.2']),
          output: Output.object({ schema: patchOutputSchema }),
          system,
          prompt: retryPrompt,
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
const BULLET_MIN_RATIO = 0.8
const BULLET_MAX_RATIO = 1
const EDITABLE_MIN_RATIO = 0.65
const EDITABLE_MAX_RATIO = 1
const MAX_VALIDATION_RETRY_ATTEMPTS = 3

function getTemplateBuffer(): Uint8Array {
  if (cachedTemplate) {
    return cachedTemplate
  }

  cachedTemplate = decodeBase64Template()
  return cachedTemplate
}

function validatePatchedData(data: ResumeData, base: ResumeData): Array<string> {
  const issues: Array<string> = []

  if (data.header.name !== base.header.name) {
    issues.push(
      `header.name was changed from "${base.header.name}" to "${data.header.name}" — must be identical`,
    )
  }
  if (data.header.email !== base.header.email) {
    issues.push(
      `header.email was changed from "${base.header.email}" to "${data.header.email}" — must be identical`,
    )
  }
  if (data.header.phone !== base.header.phone) {
    issues.push(
      `header.phone was changed from "${base.header.phone}" to "${data.header.phone}" — must be identical`,
    )
  }
  if (data.header.linkedin !== base.header.linkedin) {
    issues.push(
      `header.linkedin was changed from "${base.header.linkedin}" to "${data.header.linkedin}" — must be identical`,
    )
  }

  if (data.experience.length !== base.experience.length) {
    issues.push(
      `experience has ${data.experience.length} entries, expected ${base.experience.length}`,
    )
  } else {
    for (let i = 0; i < base.experience.length; i++) {
      const bExp = base.experience[i]
      const dExp = data.experience[i]

      if (dExp.company !== bExp.company) {
        issues.push(
          `experience[${i}].company was changed from "${bExp.company}" to "${dExp.company}" — must be identical`,
        )
      }
      if (dExp.companyMeta !== bExp.companyMeta) {
        issues.push(
          `experience[${i}].companyMeta was changed from "${bExp.companyMeta}" to "${dExp.companyMeta}" — must be identical`,
        )
      }

      if (dExp.roles.length !== bExp.roles.length) {
        issues.push(
          `experience[${i}].roles has ${dExp.roles.length} roles, expected ${bExp.roles.length}`,
        )
      } else {
        for (let r = 0; r < bExp.roles.length; r++) {
          const bRole = bExp.roles[r]
          const dRole = dExp.roles[r]

          if (dRole.meta !== bRole.meta) {
            issues.push(
              `experience[${i}].roles[${r}].meta was changed from "${bRole.meta}" to "${dRole.meta}" — must be identical`,
            )
          }

          validateLengthRange(
            issues,
            `experience[${i}].roles[${r}].title`,
            bRole.title,
            dRole.title,
            EDITABLE_MIN_RATIO,
            EDITABLE_MAX_RATIO,
          )

          if (dRole.bullets.length !== bRole.bullets.length) {
            issues.push(
              `experience[${i}].roles[${r}].bullets has ${dRole.bullets.length} bullets, expected ${bRole.bullets.length}`,
            )
          } else {
            for (let b = 0; b < bRole.bullets.length; b++) {
              validateLengthRange(
                issues,
                `experience[${i}].roles[${r}].bullets[${b}]`,
                bRole.bullets[b],
                dRole.bullets[b],
                BULLET_MIN_RATIO,
                BULLET_MAX_RATIO,
              )
            }
          }
        }
      }
    }
  }

  if (data.education.length !== base.education.length) {
    issues.push(
      `education has ${data.education.length} entries, expected ${base.education.length}`,
    )
  } else {
    for (let i = 0; i < base.education.length; i++) {
      const bEdu = base.education[i]
      const dEdu = data.education[i]

      if (dEdu.school !== bEdu.school) {
        issues.push(
          `education[${i}].school was changed from "${bEdu.school}" to "${dEdu.school}" — must be identical`,
        )
      }
      if (dEdu.location !== bEdu.location) {
        issues.push(
          `education[${i}].location was changed from "${bEdu.location}" to "${dEdu.location}" — must be identical`,
        )
      }
      if (dEdu.dates !== bEdu.dates) {
        issues.push(
          `education[${i}].dates was changed from "${bEdu.dates}" to "${dEdu.dates}" — must be identical`,
        )
      }

      validateLengthRange(
        issues,
        `education[${i}].degree`,
        bEdu.degree,
        dEdu.degree,
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )
      validateLengthRange(
        issues,
        `education[${i}].details`,
        bEdu.details,
        dEdu.details,
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )
    }
  }

  if (data.projects.length !== base.projects.length) {
    issues.push(
      `projects has ${data.projects.length} entries, expected ${base.projects.length}`,
    )
  } else {
    for (let i = 0; i < base.projects.length; i++) {
      const bProj = base.projects[i]
      const dProj = data.projects[i]

      if (dProj.dates !== bProj.dates) {
        issues.push(
          `projects[${i}].dates was changed from "${bProj.dates}" to "${dProj.dates}" — must be identical`,
        )
      }

      validateLengthRange(
        issues,
        `projects[${i}].name`,
        bProj.name,
        dProj.name,
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )

      if (dProj.bullets.length !== bProj.bullets.length) {
        issues.push(
          `projects[${i}].bullets has ${dProj.bullets.length} bullets, expected ${bProj.bullets.length}`,
        )
      } else {
        for (let b = 0; b < bProj.bullets.length; b++) {
          validateLengthRange(
            issues,
            `projects[${i}].bullets[${b}]`,
            bProj.bullets[b],
            dProj.bullets[b],
            BULLET_MIN_RATIO,
            BULLET_MAX_RATIO,
          )
        }
      }
    }
  }

  if (data.extras.length !== base.extras.length) {
    issues.push(
      `extras has ${data.extras.length} entries, expected ${base.extras.length}`,
    )
  } else {
    for (let i = 0; i < base.extras.length; i++) {
      validateLengthRange(
        issues,
        `extras[${i}]`,
        base.extras[i],
        data.extras[i],
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )
    }
  }

  validateLengthRange(
    issues,
    'skills.technical',
    base.skills.technical,
    data.skills.technical,
    EDITABLE_MIN_RATIO,
    EDITABLE_MAX_RATIO,
  )
  validateLengthRange(
    issues,
    'skills.financial',
    base.skills.financial,
    data.skills.financial,
    EDITABLE_MIN_RATIO,
    EDITABLE_MAX_RATIO,
  )
  validateLengthRange(
    issues,
    'skills.languages',
    base.skills.languages,
    data.skills.languages,
    EDITABLE_MIN_RATIO,
    EDITABLE_MAX_RATIO,
  )

  return issues
}

function validateLengthRange(
  issues: Array<string>,
  path: string,
  baseValue: string,
  newValue: string,
  minRatio: number,
  maxRatio: number,
): void {
  const originalLength = baseValue.length
  if (originalLength === 0) {
    return
  }

  const minLength = Math.floor(originalLength * minRatio)
  const maxLength = Math.ceil(originalLength * maxRatio)
  const nextLength = newValue.length

  if (nextLength < minLength || nextLength > maxLength) {
    issues.push(
      `${path} is ${nextLength} chars, allowed range is ${minLength}-${maxLength} (original: ${originalLength})`,
    )
  }
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

      await ctx.runMutation(
        internal.modules.patch.mutations.updatePdfFileId,
        {
          patchId: args.patchId,
          pdfFileId,
        },
      )

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
