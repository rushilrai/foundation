import { useCallback } from 'react'

import { PdfRenderer } from '@/modules/common/components/PdfRenderer'
import { useGenerateResumePdfDownloadUrl } from '@/modules/resume/mutations'
import type { ResumeId } from '@/modules/resume/schema'

type ResumePreviewProps = {
  resumeId: ResumeId
  pdfReady: boolean
}

export const ResumePreview = ({ resumeId, pdfReady }: ResumePreviewProps) => {
  const generatePdfDownloadUrl = useGenerateResumePdfDownloadUrl()

  const fetchUrl = useCallback(async () => {
    return await generatePdfDownloadUrl({ resumeId })
  }, [resumeId, generatePdfDownloadUrl])

  return <PdfRenderer fetchUrl={fetchUrl} pdfReady={pdfReady} />
}
