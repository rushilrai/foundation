import type { Resume } from '@/modules/resume/schema'
import { ResumePreview } from './ResumePreview'

type OriginalTabProps = {
  resume: Resume
}

export const OriginalTab = ({ resume }: OriginalTabProps) => {
  return (
    <div className="h-[calc(100vh-160px)]">
      <ResumePreview resumeId={resume._id} pdfReady={!!resume.pdfFileId} />
    </div>
  )
}
