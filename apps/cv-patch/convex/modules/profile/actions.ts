import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import { action } from '../../_generated/server'

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx): Promise<{ uploadUrl: string } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    try {
      const uploadUrl = await ctx.storage.generateUploadUrl()
      return { uploadUrl }
    } catch (error) {
      console.error('Error generating upload URL', error)
      return { error: 'UPLOAD_URL_GENERATION_FAILED' }
    }
  },
})

export const generateDocumentDownloadUrl = action({
  args: {
    documentId: v.id('documents'),
    format: v.union(v.literal('original'), v.literal('pdf')),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ downloadUrl: string } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const document = await ctx.runQuery(
      internal.modules.profile.queries.getDocumentOwnedInternal,
      { documentId: args.documentId, externalId: identity.subject },
    )

    if (!document) {
      return { error: 'DOCUMENT_NOT_FOUND' }
    }

    const fileId = args.format === 'pdf' ? document.pdfFileId : document.fileId
    if (!fileId) {
      return { error: 'PDF_NOT_AVAILABLE' }
    }

    try {
      const downloadUrl = await ctx.storage.getUrl(fileId)
      if (!downloadUrl) {
        return { error: 'DOWNLOAD_URL_GENERATION_FAILED' }
      }

      return { downloadUrl }
    } catch (error) {
      console.error('Error generating document download URL', error)
      return { error: 'DOWNLOAD_URL_GENERATION_FAILED' }
    }
  },
})
