'use node'

import { OpenAIModels, openai, setupOpenAI } from '@convex/configs/ai'
import { Output, generateText } from 'ai'
import { internal } from 'convex/_generated/api'
import { internalAction } from 'convex/_generated/server'
import { v } from 'convex/values'
import { z } from 'zod'

import { decodeBase64Template } from '../../assets/resumeTemplateData'
import {  ResumeDataSchema } from '../../../shared/resumeSchema'
import { renderResumeTemplate } from './docxTemplate'
import type {ResumeData} from '../../../shared/resumeSchema';

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

CRITICAL CONSTRAINT: The output renders into a fixed-layout DOCX template. If any field or bullet grows longer than the original, it will overflow the template and break the document formatting. Every rewritten field must stay within approximately the same character count as the original.

Strategy — in-place rewriting:
- Use strategic word substitution to incorporate exact terminology from the job description.
- Do NOT invent facts, restructure sentences, add new bullets, remove bullets, or add/remove entries.
- You MAY reorder bullets within a single role to place the most JD-relevant bullet first.
- You MAY reorder items within the skills fields (technical, financial, languages) to prioritize JD-relevant skills first.

Immutable fields — copy these exactly, byte-for-byte:
- header.name, header.phone, header.email, header.linkedin
- experience[].company, experience[].companyMeta
- experience[].roles[].meta
- education[].school, education[].location, education[].dates
- projects[].dates

Editable fields — rewrite for ATS keyword alignment while preserving approximate character length:
- experience[].roles[].title — only adjust if the JD uses a clearly equivalent title
- experience[].roles[].bullets[] — substitute keywords, keep each bullet within ~10% of its original character count
- education[].degree, education[].details — minor keyword tweaks only
- projects[].name — minor keyword tweaks only
- projects[].bullets[] — same rules as experience bullets
- skills.technical, skills.financial, skills.languages — reorder to front-load JD-relevant terms, may substitute equivalent terms
- extras[] — preserve as-is unless an entry is directly relevant to the JD, in which case minor keyword tweaks are acceptable

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

      if (!output) {
        throw new Error('LLM did not return output')
      }

      let data = output.data
      let changes = output.changes ?? []

      const issues = validatePatchedData(data, resume.data)
      if (issues.length > 0) {
        await ctx.runMutation(
          internal.modules.patch.mutations.updateStreamingText,
          {
            patchId: args.patchId,
            streamingText: 'QA detected issues. Refining output...',
          },
        )

        const retryPrompt = `${prompt}

Your previous output:
${JSON.stringify(data)}

The following validation issues were found in your previous output. Fix ONLY these issues and return the corrected JSON:
${issues.join('\n')}`

        const { output: retryOutput } = await generateText({
          model: openai.responses(OpenAIModels['gpt-5.2']),
          output: Output.object({ schema: patchOutputSchema }),
          system,
          prompt: retryPrompt,
        })

        if (retryOutput) {
          data = retryOutput.data
          changes = mergeChanges(changes, retryOutput.changes)
        }
      }

      const finalIssues = validatePatchedData(data, resume.data)
      if (finalIssues.length > 0) {
        throw new Error(
          `Patched resume failed validation: ${finalIssues.join('; ')}`,
        )
      }

      const templateBuffer = await getTemplateBuffer()
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

async function getTemplateBuffer(): Promise<Uint8Array> {
  if (cachedTemplate) {
    return cachedTemplate
  }

  cachedTemplate = decodeBase64Template()
  return cachedTemplate
}

function validatePatchedData(data: ResumeData, base: ResumeData): Array<string> {
  const issues: Array<string> = []

  // Contact info must be byte-identical
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

  // Experience: entry count, immutable fields, role/bullet counts, bullet lengths
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

          if (dRole.bullets.length !== bRole.bullets.length) {
            issues.push(
              `experience[${i}].roles[${r}].bullets has ${dRole.bullets.length} bullets, expected ${bRole.bullets.length}`,
            )
          } else {
            for (let b = 0; b < bRole.bullets.length; b++) {
              const maxLen = Math.ceil(bRole.bullets[b].length * 1.1)
              if (dRole.bullets[b].length > maxLen) {
                issues.push(
                  `experience[${i}].roles[${r}].bullets[${b}] is ${dRole.bullets[b].length} chars, max allowed is ${maxLen} (original: ${bRole.bullets[b].length})`,
                )
              }
            }
          }
        }
      }
    }
  }

  // Education: entry count, immutable fields
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
    }
  }

  // Projects: entry count, dates immutability, bullet counts, bullet lengths
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

      if (dProj.bullets.length !== bProj.bullets.length) {
        issues.push(
          `projects[${i}].bullets has ${dProj.bullets.length} bullets, expected ${bProj.bullets.length}`,
        )
      } else {
        for (let b = 0; b < bProj.bullets.length; b++) {
          const maxLen = Math.ceil(bProj.bullets[b].length * 1.1)
          if (dProj.bullets[b].length > maxLen) {
            issues.push(
              `projects[${i}].bullets[${b}] is ${dProj.bullets[b].length} chars, max allowed is ${maxLen} (original: ${bProj.bullets[b].length})`,
            )
          }
        }
      }
    }
  }

  // Extras: count must match
  if (data.extras.length !== base.extras.length) {
    issues.push(
      `extras has ${data.extras.length} entries, expected ${base.extras.length}`,
    )
  }

  return issues
}

function mergeChanges(primary?: Array<string>, secondary?: Array<string>): Array<string> {
  const merged = new Set<string>()
  for (const change of primary ?? []) {
    merged.add(change)
  }
  for (const change of secondary ?? []) {
    merged.add(change)
  }
  return Array.from(merged)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}
