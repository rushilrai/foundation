import type { Resume } from '@/modules/resume/schema'
import { ResumePreview } from './ResumePreview'
import { ResumeRatingCard } from './ResumeRatingCard'

type OriginalTabProps = {
  resume: Resume
}

export const OriginalTab = ({ resume }: OriginalTabProps) => {
  return (
    <div className="grid h-[calc(100vh-160px)] grid-cols-3 gap-6">
      <div className="col-span-2">
        <ResumePreview resumeId={resume._id} pdfReady={!!resume.pdfFileId} />
      </div>

      <div className="space-y-4 overflow-auto">
        <ResumeRatingCard resume={resume} />
      </div>
    </div>
  )
}
