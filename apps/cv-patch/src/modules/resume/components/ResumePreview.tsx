import { api } from '@convex/_generated/api.js'
import { useAction } from 'convex/react'
import { useCallback } from 'react'
import type { Id } from '@convex/_generated/dataModel.js'

import { PdfRenderer } from '@/modules/common/components/PdfRenderer'

type ResumePreviewProps = {
  resumeId: Id<'resumes'>
  pdfReady: boolean
}

export const ResumePreview = ({ resumeId, pdfReady }: ResumePreviewProps) => {
  const generatePdfDownloadUrl = useAction(
    api.modules.resume.actions.generatePdfDownloadUrl,
  )

  const fetchUrl = useCallback(async () => {
    return await generatePdfDownloadUrl({ resumeId })
  }, [resumeId, generatePdfDownloadUrl])

  return <PdfRenderer fetchUrl={fetchUrl} pdfReady={pdfReady} />
}
