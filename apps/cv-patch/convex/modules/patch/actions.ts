import { v } from 'convex/values'

import { api } from '../../_generated/api'
import { action } from '../../_generated/server'

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

    // The public query enforces ownership with the caller's identity.
    const result = await ctx.runQuery(api.modules.patch.queries.get, {
      patchId: args.patchId,
    })
    if ('error' in result) {
      return { error: result.error }
    }
    const { patch } = result

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

export const generatePdfDownloadUrl = action({
  args: { patchId: v.id('patches') },
  handler: async (
    ctx,
    args,
  ): Promise<{ downloadUrl: string } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    // The public query enforces ownership with the caller's identity.
    const result = await ctx.runQuery(api.modules.patch.queries.get, {
      patchId: args.patchId,
    })
    if ('error' in result) {
      return { error: result.error }
    }
    const { patch } = result

    if (!patch.pdfFileId) {
      return { error: 'PDF_NOT_AVAILABLE' }
    }

    try {
      const downloadUrl = await ctx.storage.getUrl(patch.pdfFileId)
      if (!downloadUrl) {
        return { error: 'DOWNLOAD_URL_GENERATION_FAILED' }
      }
      return { downloadUrl }
    } catch (error) {
      console.error('Error generating PDF download URL', error)
      return { error: 'DOWNLOAD_URL_GENERATION_FAILED' }
    }
  },
})
