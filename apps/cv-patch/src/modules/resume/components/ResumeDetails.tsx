import type { Resume } from '@/modules/resume/schema'

type ResumeDetailsProps = {
  resume: Resume
}

export const ResumeDetails = ({ resume }: ResumeDetailsProps) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{resume.fileName}</span>
      <span>·</span>
      <span>Uploaded {formatDate(resume.createdAt)}</span>

      {resume.errorMessage && (
        <>
          <span>·</span>
          <span className="text-destructive">{resume.errorMessage}</span>
        </>
      )}
    </div>
  )
}
