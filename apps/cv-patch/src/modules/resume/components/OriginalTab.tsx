import type { Doc } from '@convex/_generated/dataModel.js'

import { ResumePreview } from './ResumePreview'
import { ResumeDetails } from './ResumeDetails'

type OriginalTabProps = {
  resume: Doc<"resumes">
}

export const OriginalTab = ({ resume }: OriginalTabProps) => {
  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      <div className="col-span-2">
        <ResumePreview resumeId={resume._id} />
      </div>

      <div className="space-y-4 overflow-auto">
        <ResumeDetails resume={resume} />
      </div>
    </div>
  )
}
