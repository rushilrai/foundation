import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { PatchPreview } from '@/modules/patch/components/PatchPreview'
import { useGeneratePatchDownloadUrl } from '@/modules/patch/mutations'
import { usePatch } from '@/modules/patch/queries'
import type { PatchId } from '@/modules/patch/schema'
import { DashboardHeader } from '@/screens/dashboard/components/dashboard-header'

const statusVariantMap = {
  processing: 'processing',
  generating: 'generating',
  ready: 'success',
  error: 'error',
} as const

export function PatchDetailScreen({ patchId }: { patchId: string }) {
  const patchResult = usePatch(patchId as PatchId)

  const generateDownloadUrl = useGeneratePatchDownloadUrl()

  const handleDownload = async () => {
    const result = await generateDownloadUrl({
      patchId: patchId as PatchId,
    })

    if ('downloadUrl' in result) {
      window.open(result.downloadUrl, '_blank')
    }
  }

  if (patchResult === undefined) {
    return (
      <>
        <DashboardHeader>
          <Skeleton className="h-6 w-48" />
        </DashboardHeader>

        <div className="flex">
          <div className="w-1/2 border-r p-6">
            <Skeleton className="h-full" />
          </div>

          <div className="w-1/2 p-6">
            <Skeleton className="h-full" />
          </div>
        </div>
      </>
    )
  }

  if ('error' in patchResult) {
    return (
      <>
        <DashboardHeader title="Error" />

        <div className="p-6">
          <p className="text-destructive">
            {patchResult.error === 'PATCH_NOT_FOUND'
              ? 'Patch not found.'
              : 'An error occurred while loading the patch.'}
          </p>
        </div>
      </>
    )
  }

  const { patch } = patchResult

  return (
    <>
      <DashboardHeader title={patch.title}>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              statusVariantMap[patch.status as keyof typeof statusVariantMap] ??
              'secondary'
            }
          >
            {patch.status}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={patch.status !== 'ready'}
          >
            Download DOCX
          </Button>
        </div>
      </DashboardHeader>

      <div className="flex min-h-0 flex-1 flex-row">
        <div className="flex w-1/2 flex-col border-r p-6">
          <div>
            <h2 className="text-lg font-semibold">Job Description</h2>

            {patch.companyName && (
              <p className="text-sm text-muted-foreground">
                {patch.companyName}
                {patch.roleName && ` - ${patch.roleName}`}
              </p>
            )}
          </div>

          <div className="mt-4 overflow-auto text-sm leading-relaxed whitespace-pre-wrap">
            {patch.jobDescription}
          </div>

          <Separator className="my-4" />

          {patch.changes && patch.changes.length > 0 && (
            <div className="flex flex-col overflow-hidden">
              <h3 className="text-md mb-2 font-semibold">Changes Made</h3>

              <ul className="space-y-1 overflow-auto">
                {patch.changes.map((change, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="text-primary">•</span>

                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex w-1/2 flex-col p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tailored Resume</h2>
          </div>

          <div>
            {patch.status === 'generating' ? (
              <div className="h-96 w-full overflow-auto rounded-lg border-2 border-accent bg-muted p-4">
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />

                  <p className="text-sm text-muted-foreground">
                    Generating tailored resume...
                  </p>
                </div>

                {patch.streamingText && (
                  <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                    {patch.streamingText}
                  </pre>
                )}
              </div>
            ) : patch.status === 'error' ? (
              <div className="flex h-96 w-full items-center justify-center rounded-lg bg-muted">
                <p className="text-sm text-destructive">
                  {patch.errorMessage || 'An error occurred during generation.'}
                </p>
              </div>
            ) : (
              <PatchPreview patchId={patch._id} pdfReady={!!patch.pdfFileId} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
