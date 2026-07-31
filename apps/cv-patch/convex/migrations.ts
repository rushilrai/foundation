import type { ResumeData } from '../shared/resumeSchema'
import { internalMutation } from './_generated/server'

type LegacyHeader = {
  name: string
  phone: string
  email: string
  linkedin?: string
  location?: string
  links?: ResumeData['header']['links']
}

function migrateHeader(data: ResumeData): ResumeData | null {
  const header = data.header as unknown as LegacyHeader

  if (header.links !== undefined && header.location !== undefined) {
    return null
  }

  const linkedin = header.linkedin?.trim() ?? ''

  return {
    ...data,
    header: {
      name: header.name,
      phone: header.phone,
      email: header.email,
      // Never captured by the legacy schema; not recoverable.
      location: header.location ?? '',
      links:
        header.links ??
        (linkedin ? [{ label: 'LinkedIn', url: linkedin }] : []),
    },
  }
}

// One-off legacy-header backfill; run before re-enabling schemaValidation.
export const migrateHeaderLinks = internalMutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    resumesMigrated: number
    patchesMigrated: number
    versionsMigrated: number
  }> => {
    let resumesMigrated = 0
    let patchesMigrated = 0
    let versionsMigrated = 0

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

    const versions = await ctx.db.query('patchVersions').collect()
    for (const version of versions) {
      const migrated = migrateHeader(version.data)
      if (migrated) {
        await ctx.db.patch(version._id, { data: migrated })
        versionsMigrated++
      }
    }

    return { resumesMigrated, patchesMigrated, versionsMigrated }
  },
})

// One-off: backfills v1 version rows for pre-agent patches.
export const migratePatchVersions = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ versionsCreated: number }> => {
    let versionsCreated = 0

    const patches = await ctx.db.query('patches').collect()
    for (const patch of patches) {
      if (patch.activeVersionId || !patch.data || !patch.patchedFileId) {
        continue
      }

      const existing = await ctx.db
        .query('patchVersions')
        .withIndex('by_patchId', (q) => q.eq('patchId', patch._id))
        .first()
      if (existing) {
        continue
      }

      const versionId = await ctx.db.insert('patchVersions', {
        patchId: patch._id,
        userId: patch.userId,
        versionNumber: 1,
        data: patch.data,
        changes: patch.changes ?? [],
        patchedFileId: patch.patchedFileId,
        pdfFileId: patch.pdfFileId,
        pageCount: null,
        createdAt: patch.createdAt,
      })

      await ctx.db.patch(patch._id, { activeVersionId: versionId })
      versionsCreated++
    }

    return { versionsCreated }
  },
})
