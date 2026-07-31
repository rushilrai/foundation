import type { ResumeData } from '../shared/resumeSchema'
import { internalMutation } from './_generated/server'

type LegacyHeader = {
  name: string
  phone: string
  email: string
  linkedin?: string
  links?: ResumeData['header']['links']
}

function migrateHeader(data: ResumeData): ResumeData | null {
  const header = data.header as unknown as LegacyHeader

  if (header.links !== undefined) {
    return null
  }

  const linkedin = header.linkedin?.trim() ?? ''

  return {
    ...data,
    header: {
      name: header.name,
      phone: header.phone,
      email: header.email,
      links: linkedin ? [{ label: 'LinkedIn', url: linkedin }] : [],
    },
  }
}

// One-off: converts header.linkedin to header.links on all resumes and
// patches. Run with `npx convex run migrations:migrateHeaderLinks` after
// deploying, then re-enable schemaValidation in convex/schema.ts.
export const migrateHeaderLinks = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ resumesMigrated: number; patchesMigrated: number }> => {
    let resumesMigrated = 0
    let patchesMigrated = 0

    const resumes = await ctx.db.query('resumes').collect()
    for (const resume of resumes) {
      if (!resume.data) {
        continue
      }
      const migrated = migrateHeader(resume.data)
      if (migrated) {
        await ctx.db.patch(resume._id, { data: migrated })
        resumesMigrated++
      }
    }

    const patches = await ctx.db.query('patches').collect()
    for (const patch of patches) {
      if (!patch.data) {
        continue
      }
      const migrated = migrateHeader(patch.data)
      if (migrated) {
        await ctx.db.patch(patch._id, { data: migrated })
        patchesMigrated++
      }
    }

    return { resumesMigrated, patchesMigrated }
  },
})
