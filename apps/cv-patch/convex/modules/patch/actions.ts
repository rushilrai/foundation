import { v } from 'convex/values'

import { internal } from '../../_generated/api'
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

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByIdOwnedInternal,
      {
        patchId: args.patchId,
        externalId: identity.subject,
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

export const generateCoverLetterDownloadUrl = action({
  args: {
    patchId: v.id('patches'),
    format: v.union(v.literal('docx'), v.literal('pdf')),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ downloadUrl: string } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByIdOwnedInternal,
      {
        patchId: args.patchId,
        externalId: identity.subject,
      },
    )

    if (!patch) {
      return { error: 'PATCH_NOT_FOUND' }
    }

    const fileId =
      args.format === 'docx'
        ? patch.coverLetter?.fileId
        : patch.coverLetter?.pdfFileId

    if (!fileId) {
      return { error: 'COVER_LETTER_NOT_AVAILABLE' }
    }

    try {
      const downloadUrl = await ctx.storage.getUrl(fileId)
      if (!downloadUrl) {
        return { error: 'DOWNLOAD_URL_GENERATION_FAILED' }
      }
      return { downloadUrl }
    } catch (error) {
      console.error('Error generating cover letter download URL', error)
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

    const patch = await ctx.runQuery(
      internal.modules.patch.queries.getByIdOwnedInternal,
      {
        patchId: args.patchId,
        externalId: identity.subject,
      },
    )

    if (!patch) {
      return { error: 'PATCH_NOT_FOUND' }
    }

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
