import { internal } from 'convex/_generated/api'
import { internalAction } from 'convex/_generated/server'

export const backfillPdfs = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    // Find all ready resumes without a PDF
    const resumes = await ctx.runQuery(
      internal.modules.common.migrationsHelpers.getResumesWithoutPdf,
    )

    console.log(
      `[backfillPdfs] Found ${resumes.length} resumes without PDF`,
    )

    for (const resume of resumes) {
      await ctx.scheduler.runAfter(
        0,
        internal.modules.resume.nodeActions.convertResumeToPdf,
        { resumeId: resume._id },
      )
    }

    // Find all ready patches without a PDF
    const patches = await ctx.runQuery(
      internal.modules.common.migrationsHelpers.getPatchesWithoutPdf,
    )

    console.log(
      `[backfillPdfs] Found ${patches.length} patches without PDF`,
    )

    for (const patch of patches) {
      await ctx.scheduler.runAfter(
        0,
        internal.modules.patch.nodeActions.convertPatchToPdf,
        { patchId: patch._id },
      )
    }

    console.log(
      `[backfillPdfs] Scheduled ${resumes.length} resume + ${patches.length} patch conversions`,
    )
  },
})
