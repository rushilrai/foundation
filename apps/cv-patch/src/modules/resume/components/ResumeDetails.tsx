import type { Doc } from '@convex/_generated/dataModel.js'

type ResumeDetailsProps = {
  resume: Doc<'resumes'>
}

export const ResumeDetails = ({ resume }: ResumeDetailsProps) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-muted-foreground">File Name</h3>

        <p className="mt-1 text-sm">{resume.fileName}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground">File Size</h3>

        <p className="mt-1 text-sm">{formatFileSize(resume.fileSize)}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground">Uploaded</h3>

        <p className="mt-1 text-sm">{formatDate(resume.createdAt)}</p>
      </div>

      {resume.errorMessage && (
        <div>
          <h3 className="text-sm font-medium text-destructive">Error</h3>

          <p className="mt-1 text-sm text-destructive">{resume.errorMessage}</p>
        </div>
      )}
    </div>
  )
}
