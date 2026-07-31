import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PatchChat } from '@/modules/patch/components/PatchChat'
import { PatchCoverLetter } from '@/modules/patch/components/PatchCoverLetter'
import { PatchDiff } from '@/modules/patch/components/PatchDiff'
import { PatchPreview } from '@/modules/patch/components/PatchPreview'
import { PatchVersions } from '@/modules/patch/components/PatchVersions'
import { useGeneratePatchDownloadUrl } from '@/modules/patch/mutations'
import { usePatch } from '@/modules/patch/queries'
import type { Patch, PatchId } from '@/modules/patch/schema'
import { useResume } from '@/modules/resume/queries'
import { DashboardHeader } from '@/screens/dashboard/components/dashboard-header'

const statusVariantMap = {
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

        <div className="flex min-h-0 flex-1">
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
        <div className="flex w-1/2 min-w-0 flex-col border-r">
          {patch.status === 'error' && (
            <div className="border-b bg-destructive/10 px-6 py-3">
              <p className="text-sm text-destructive">
                {patch.errorMessage || 'An error occurred during generation.'}
              </p>
            </div>
          )}

          <PatchChat patch={patch} />
        </div>

        <div className="flex w-1/2 min-w-0 flex-col overflow-y-auto p-6">
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
              <TabsTrigger value="diff">Diff</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
              <TabsTrigger value="jd">Job Description</TabsTrigger>
            </TabsList>

            <TabsContent value="preview" className="mt-6">
              {patch.status === 'generating' ? (
                <div className="flex h-96 w-full items-center justify-center rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
                    <p className="text-sm text-muted-foreground">
                      Generating tailored resume...
                    </p>
                  </div>
                </div>
              ) : patch.status === 'ready' && !patch.pdfFileId ? (
                <div className="flex h-96 w-full items-center justify-center rounded-lg bg-muted">
                  <p className="px-6 text-center text-sm text-muted-foreground">
                    PDF preview is unavailable for this version — the DOCX
                    download still works.
                  </p>
                </div>
              ) : (
                <PatchPreview
                  patchId={patch._id}
                  pdfReady={!!patch.pdfFileId}
                />
              )}
            </TabsContent>

            <TabsContent value="cover-letter" className="mt-6">
              <PatchCoverLetter patch={patch} />
            </TabsContent>

            <TabsContent value="diff" className="mt-6">
              <DiffTabContent patch={patch} />
            </TabsContent>

            <TabsContent value="versions" className="mt-6">
              <PatchVersions patch={patch} />
            </TabsContent>

            <TabsContent value="jd" className="mt-6">
              {(patch.companyName || patch.roleName) && (
                <p className="mb-3 text-sm text-muted-foreground">
                  {patch.companyName}
                  {patch.roleName && ` - ${patch.roleName}`}
                </p>
              )}

              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {patch.jobDescription}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  )
}

const DiffTabContent = ({ patch }: { patch: Patch }) => {
  const resumeResult = useResume(patch.resumeId)

  if (!patch.data) {
    return (
      <p className="text-sm text-muted-foreground">
        No tailored version yet — the diff appears once the agent saves one.
      </p>
    )
  }

  if (resumeResult === undefined) {
    return <Skeleton className="h-24 w-full" />
  }

  if ('error' in resumeResult || !resumeResult.resume.data) {
    return (
      <p className="text-sm text-destructive">Failed to load base resume.</p>
    )
  }

  return <PatchDiff base={resumeResult.resume.data} patched={patch.data} />
}
