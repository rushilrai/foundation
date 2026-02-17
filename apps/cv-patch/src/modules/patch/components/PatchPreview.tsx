import { api } from '@convex/_generated/api.js'
import { useAction } from 'convex/react'
import { useCallback } from 'react'
import type { Id } from '@convex/_generated/dataModel.js'

import { PdfRenderer } from '@/modules/common/components/PdfRenderer'

type PatchPreviewProps = {
  patchId: Id<'patches'>
  pdfReady: boolean
}

export const PatchPreview = ({ patchId, pdfReady }: PatchPreviewProps) => {
  const generatePdfDownloadUrl = useAction(
    api.modules.patch.actions.generatePdfDownloadUrl,
  )

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
