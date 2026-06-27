import type { Doc } from '@convex/_generated/dataModel.js'

import { ResumeDetails } from './ResumeDetails'
import { ResumePreview } from './ResumePreview'

type OriginalTabProps = {
  resume: Doc<'resumes'>
}

export const OriginalTab = ({ resume }: OriginalTabProps) => {
  return (
    <div className="grid h-[calc(100vh-200px)] grid-cols-3 gap-6">
      <div className="col-span-2">
        <ResumePreview resumeId={resume._id} pdfReady={!!resume.pdfFileId} />
      </div>

      <div className="space-y-4 overflow-auto">
        <ResumeDetails resume={resume} />
      </div>
    </div>
  )
}
