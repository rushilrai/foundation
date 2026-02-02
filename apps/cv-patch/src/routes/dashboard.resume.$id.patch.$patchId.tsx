import { api } from '@convex/_generated/api.js'
import type { Id } from '@convex/_generated/dataModel.js'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useAction } from 'convex/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { DashboardHeader } from '@/modules/common/components/DashboardHeader'
import { PatchPreview } from '@/modules/patch/components/PatchPreview'

const statusVariantMap = {
  processing: 'processing',
  generating: 'generating',
  ready: 'success',
  error: 'error',
} as const

export const Route = createFileRoute('/dashboard/resume/$id/patch/$patchId')({
  component: PatchDetailPage,
})

function PatchDetailPage() {
  const { patchId } = Route.useParams()
  const patchResult = useQuery(api.modules.patch.queries.get, {
    patchId: patchId as Id<'patches'>,
  })

  const generateDownloadUrl = useAction(
    api.modules.patch.actions.generateDownloadUrl,
  )

  const handleDownload = async () => {
    const result = await generateDownloadUrl({
      patchId: patchId as Id<'patches'>,
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

        <main className="flex h-[calc(100vh-65px)]">
          <div className="w-1/2 border-r p-6">
            <Skeleton className="h-full" />
          </div>

          <div className="w-1/2 p-6">
            <Skeleton className="h-full" />
          </div>
        </main>
      </>
    )
  }

  if ('error' in patchResult) {
    return (
      <>
        <DashboardHeader title="Error" />

        <main className="p-6">
          <p className="text-destructive">
            {patchResult.error === 'PATCH_NOT_FOUND'
              ? 'Patch not found.'
              : 'An error occurred while loading the patch.'}
          </p>
        </main>
      </>
    )
  }

  const { patch } = patchResult

  return (
    <>
      <DashboardHeader title={patch.title}>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariantMap[patch.status as keyof typeof statusVariantMap] ?? 'secondary'}>
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

      <main className="flex h-[calc(100vh-65px)]">
        <div className="w-1/2 border-r p-6 overflow-hidden flex flex-col">
          <div className="shrink-0">
            <h2 className="text-lg font-semibold">Job Description</h2>

            {patch.companyName && (
              <p className="text-sm text-muted-foreground">
                {patch.companyName}
                {patch.roleName && ` - ${patch.roleName}`}
              </p>
            )}
          </div>

          <div className="whitespace-pre-wrap text-sm leading-relaxed overflow-auto flex-1 mt-4">
            {patch.jobDescription}
          </div>
        </div>

        <div className="w-1/2 p-6 flex flex-col overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 shrink-0">
            Tailored Resume
          </h2>

          <div className="shrink-0">
            {patch.status === 'generating' ? (
              <div className="h-96 w-full border-2 border-accent bg-muted rounded-lg p-4 overflow-auto">
                <div className="flex items-center gap-2 mb-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />

                  <p className="text-muted-foreground text-sm">
                    Generating tailored resume...
                  </p>
                </div>

                {patch.streamingText && (
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                    {patch.streamingText}
                  </pre>
                )}
              </div>
            ) : patch.status === 'error' ? (
              <div className="h-96 w-full bg-muted rounded-lg flex items-center justify-center">
                <p className="text-destructive text-sm">
                  {patch.errorMessage || 'An error occurred during generation.'}
                </p>
              </div>
            ) : (
              <PatchPreview patchId={patch._id} />
            )}
          </div>

          {patch.changes && patch.changes.length > 0 && (
            <div className="mt-4 flex-1 overflow-hidden flex flex-col">
              <h3 className="text-md font-semibold mb-2 shrink-0">
                Changes Made
              </h3>

              <ul className="space-y-1 overflow-auto flex-1">
                {patch.changes.map((change, i) => (
                  <li
                    key={i}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <span className="text-primary">•</span>

                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
