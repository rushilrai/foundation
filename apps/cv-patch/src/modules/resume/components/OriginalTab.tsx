import type { Resume } from '@/modules/resume/schema'
import { ResumePreview } from './ResumePreview'

type OriginalTabProps = {
  resume: Resume
}

export const OriginalTab = ({ resume }: OriginalTabProps) => {
  if (resume.status === 'error') {
    return (
      <div className="flex h-140 w-full items-center justify-center rounded-lg bg-muted">
        <p className="text-sm text-destructive">
          {resume.errorMessage || 'Failed to process this resume.'}
        </p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-160px)]">
      <ResumePreview resumeId={resume._id} pdfReady={!!resume.pdfFileId} />
    </div>
  )
}
