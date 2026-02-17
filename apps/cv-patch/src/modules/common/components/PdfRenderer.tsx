import { useEffect, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

type PdfRendererProps = {
  fetchUrl: () => Promise<{ downloadUrl: string } | { error: string }>
  pdfReady: boolean
  errorMessage?: string
  notReadyMessage?: string
}

export const PdfRenderer = ({
  fetchUrl,
  pdfReady,
  errorMessage = 'Unable to load preview',
  notReadyMessage = 'Generating PDF preview...',
}: PdfRendererProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pdfReady) {
      setPdfUrl(null)
      return
    }

    const loadPdf = async () => {
      setLoading(true)
      setError(null)

      try {
        const result = await fetchUrl()

        if ('error' in result) {
          setError(result.error)
          return
        }

        setPdfUrl(result.downloadUrl)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load PDF',
        )
      } finally {
        setLoading(false)
      }
    }

    loadPdf()
  }, [fetchUrl, pdfReady])

  if (!pdfReady) {
    return (
      <div className="h-140 w-full border-2 border-accent bg-muted rounded-lg flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          <p className="text-muted-foreground text-sm">{notReadyMessage}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full w-full">
        <Skeleton className="h-140 w-full rounded-lg" />
      </div>
    )
  }

  if (error || !pdfUrl) {
    return (
      <div className="h-140 w-full bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground text-sm">{errorMessage}</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <iframe
        src={pdfUrl}
        title="PDF Preview"
        className="h-140 w-full border-2 border-accent rounded-lg"
      />
    </div>
  )
}
