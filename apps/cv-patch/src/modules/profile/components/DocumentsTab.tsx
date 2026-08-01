import { IconFileText, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentRatingCard } from '@/modules/profile/components/DocumentRatingCard'
import { UploadDocumentDialog } from '@/modules/profile/components/UploadDocumentDialog'
import {
  useGenerateDocumentDownloadUrl,
  useRemoveDocument,
} from '@/modules/profile/mutations'
import { useProfileDocuments } from '@/modules/profile/queries'
import type { DocumentId, ProfileId } from '@/modules/profile/schema'

const statusVariantMap = {
  processing: 'processing',
  ready: 'success',
  error: 'error',
} as const

const kindLabels = {
  resume: 'Resume',
  coverLetter: 'Cover letter',
  other: 'Other',
} as const

type DocumentsTabProps = {
  profileId: ProfileId
}

export const DocumentsTab = ({ profileId }: DocumentsTabProps) => {
  const documentsResult = useProfileDocuments(profileId)
  const generateDownloadUrl = useGenerateDocumentDownloadUrl()
  const removeDocument = useRemoveDocument()

  const [removingId, setRemovingId] = useState<DocumentId | null>(null)
  const [downloadError, setDownloadError] = useState<{
    documentId: DocumentId
    message: string
  } | null>(null)

  const handleDownload = async (
    documentId: DocumentId,
    format: 'original' | 'pdf',
  ) => {
    setDownloadError(null)
    try {
      const result = await generateDownloadUrl({ documentId, format })
      if ('error' in result) {
        setDownloadError({
          documentId,
          message:
            result.error === 'PDF_NOT_AVAILABLE'
              ? 'The PDF version is not available yet.'
              : 'Failed to get a download link.',
        })
        return
      }
      window.open(result.downloadUrl, '_blank')
    } catch (error) {
      console.error('Failed to get download URL', error)
      setDownloadError({
        documentId,
        message: 'Failed to get a download link.',
      })
    }
  }

  const handleRemove = async (documentId: DocumentId) => {
    setRemovingId(documentId)
    try {
      await removeDocument({ documentId })
    } catch (error) {
      console.error('Failed to delete document', error)
    } finally {
      setRemovingId(null)
    }
  }

  if (documentsResult === undefined) {
    return <Skeleton className="h-48" />
  }

  if ('error' in documentsResult) {
    return (
      <p className="text-sm text-destructive">
        An error occurred while loading the documents.
      </p>
    )
  }

  const { documents } = documentsResult

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Documents</h3>
          <p className="text-sm text-muted-foreground">
            Uploaded files the agent reads to build this profile.
          </p>
        </div>

        <UploadDocumentDialog profileId={profileId}>
          <Button variant="default" size="sm">
            <IconPlus className="size-4" />
            Upload Document
          </Button>
        </UploadDocumentDialog>
      </div>

      {documents.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No documents yet. Upload your resume to get started.
        </p>
      )}

      {documents.map((document) => (
        <div key={document._id} className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <IconFileText className="size-4 shrink-0 text-muted-foreground" />
              <p className="truncate text-sm font-medium">{document.title}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline">{kindLabels[document.kind]}</Badge>
              <Badge variant={statusVariantMap[document.status]}>
                {document.status}
              </Badge>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {document.fileName} ·{' '}
            {new Date(document.createdAt).toLocaleDateString()}
          </p>

          {document.status === 'error' && (
            <p className="text-sm text-destructive">
              {document.errorMessage || 'Failed to process the document.'}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(document._id, 'original')}
            >
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(document._id, 'pdf')}
              disabled={!document.pdfFileId}
            >
              View PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(document._id)}
              disabled={removingId === document._id}
            >
              {removingId === document._id ? 'Deleting...' : 'Delete'}
            </Button>
          </div>

          {downloadError?.documentId === document._id && (
            <p className="text-sm text-destructive">{downloadError.message}</p>
          )}

          {document.kind === 'resume' && document.rating && (
            <DocumentRatingCard rating={document.rating} />
          )}
        </div>
      ))}
    </div>
  )
}
