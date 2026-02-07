import { renderAsync } from 'docx-preview'
import { useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

type DocxRendererProps = {
  fetchUrl: () => Promise<{ downloadUrl: string } | { error: string }>
  errorMessage?: string
}

export const DocxRenderer = ({
  fetchUrl,
  errorMessage = 'Unable to load preview',
}: DocxRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDocx = async () => {
      if (!containerRef.current) return

      setLoading(true)
      setError(null)

      try {
        const result = await fetchUrl()

        if ('error' in result) {
          setError(result.error)
          return
        }

        const response = await fetch(result.downloadUrl)
        const blob = await response.blob()

        containerRef.current.innerHTML = ''

        await renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    loadDocx()
  }, [fetchUrl])

  return (
    <div className="h-full w-full relative">
      <div
        ref={containerRef}
        className={`h-140 w-full border-2 border-accent bg-white rounded-lg overflow-auto ${loading || error ? 'invisible' : ''}`}
      />

      {loading && (
        <div className="absolute inset-0 bg-muted rounded-lg p-4">
          <Skeleton className="h-full w-full" />
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 bg-muted rounded-lg flex items-center justify-center">
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
        </div>
      )}
    </div>
  )
}
