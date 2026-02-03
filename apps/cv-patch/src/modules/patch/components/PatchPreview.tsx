import { api } from '@convex/_generated/api.js'
import type { Id } from '@convex/_generated/dataModel.js'
import { useAction } from 'convex/react'
import { useCallback } from 'react'

import { DocxRenderer } from '@/modules/common/components/DocxRenderer'

type PatchPreviewProps = {
  patchId: Id<'patches'>
}

export const PatchPreview = ({ patchId }: PatchPreviewProps) => {
  const generateDownloadUrl = useAction(
    api.modules.patch.actions.generateDownloadUrl,
  )

  const fetchUrl = useCallback(async () => {
    return await generateDownloadUrl({ patchId })
  }, [patchId, generateDownloadUrl])

  return <DocxRenderer fetchUrl={fetchUrl} errorMessage="Document not ready yet..." />
}
