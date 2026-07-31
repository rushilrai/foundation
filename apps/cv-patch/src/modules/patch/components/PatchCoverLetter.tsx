import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useGenerateCoverLetterDownloadUrl } from '@/modules/patch/mutations'
import type { Patch } from '@/modules/patch/schema'

type PatchCoverLetterProps = {
  patch: Patch
}

export const PatchCoverLetter = ({ patch }: PatchCoverLetterProps) => {
  const generateDownloadUrl = useGenerateCoverLetterDownloadUrl()
  const [downloading, setDownloading] = useState<'docx' | 'pdf' | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const { coverLetter } = patch

  if (!coverLetter) {
    return (
      <p className="text-sm text-muted-foreground">
        No cover letter yet — ask the agent to write one in the chat.
      </p>
    )
  }

  const handleDownload = async (format: 'docx' | 'pdf') => {
    setDownloading(format)
    setDownloadError(null)
    try {
      const result = await generateDownloadUrl({ patchId: patch._id, format })
      if ('downloadUrl' in result) {
        window.open(result.downloadUrl, '_blank')
      } else {
        setDownloadError('Download failed. Please try again.')
      }
    } catch (error) {
      console.error('Failed to download cover letter', error)
      setDownloadError('Download failed. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-4">
      {downloadError && (
        <p className="text-sm text-destructive">{downloadError}</p>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Generated {new Date(coverLetter.generatedAt).toLocaleString()}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload('docx')}
            disabled={downloading !== null}
          >
            {downloading === 'docx' ? 'Preparing...' : 'Download DOCX'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload('pdf')}
            disabled={downloading !== null || !coverLetter.pdfFileId}
          >
            {downloading === 'pdf' ? 'Preparing...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-6 text-sm leading-relaxed">
        <p>{coverLetter.greeting}</p>

        {coverLetter.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}

        <p>
          Sincerely,
          <br />
          {patch.data?.header.name ?? ''}
        </p>
      </div>
    </div>
  )
}
