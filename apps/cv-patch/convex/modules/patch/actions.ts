import { internal } from 'convex/_generated/api'
import { action } from 'convex/_generated/server'
import { v } from 'convex/values'

export const generateDownloadUrl = action({
  args: { patchId: v.id('patches') },
  handler: async (
    ctx,
    args,
  ): Promise<{ downloadUrl: string } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByIdInternal,
      {
        patchId: args.patchId,
      },
    )

    if (!patch) {
      return { error: 'PATCH_NOT_FOUND' }
    }

    if (!patch.patchedFileId) {
      return { error: 'PATCHED_FILE_NOT_AVAILABLE' }
    }

    try {
      const downloadUrl = await ctx.storage.getUrl(patch.patchedFileId)
      if (!downloadUrl) {
        return { error: 'DOWNLOAD_URL_GENERATION_FAILED' }
      }
      return { downloadUrl }
    } catch (error) {
      console.error('Error generating download URL', error)
      return { error: 'DOWNLOAD_URL_GENERATION_FAILED' }
    }
  },
})
