import { api } from '@convex/_generated/api.js'
import { useAction } from 'convex/react'
import { useCallback } from 'react'
import type { Id } from '@convex/_generated/dataModel.js'

import { DocxRenderer } from '@/modules/common/components/DocxRenderer'

type ResumePreviewProps = {
  resumeId: Id<'resumes'>
}

export const ResumePreview = ({ resumeId }: ResumePreviewProps) => {
  const generateDownloadUrl = useAction(
    api.modules.resume.actions.generateDownloadUrl,
  )

  const fetchUrl = useCallback(async () => {
    return await generateDownloadUrl({ resumeId })
  }, [resumeId, generateDownloadUrl])

  return <DocxRenderer fetchUrl={fetchUrl} />
}
