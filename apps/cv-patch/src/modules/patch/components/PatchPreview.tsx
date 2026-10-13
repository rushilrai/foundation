import { useCallback } from 'react'

import { PdfRenderer } from '@/modules/common/components/PdfRenderer'
import { useGeneratePatchPdfDownloadUrl } from '@/modules/patch/mutations'
import type { PatchId } from '@/modules/patch/schema'

type PatchPreviewProps = {
  patchId: PatchId
  pdfReady: boolean
}

export const PatchPreview = ({ patchId, pdfReady }: PatchPreviewProps) => {
  const generatePdfDownloadUrl = useGeneratePatchPdfDownloadUrl()

  const fetchUrl = useCallback(async () => {
    return await generatePdfDownloadUrl({ patchId })
  }, [patchId, generatePdfDownloadUrl])

  return (
    <PdfRenderer
      fetchUrl={fetchUrl}
      pdfReady={pdfReady}
      errorMessage="Document not ready yet..."
      notReadyMessage="Generating PDF preview..."
    />
  )
}
