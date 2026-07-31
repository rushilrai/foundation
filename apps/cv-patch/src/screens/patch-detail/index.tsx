import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PatchChat } from '@/modules/patch/components/PatchChat'
import { PatchCoverLetter } from '@/modules/patch/components/PatchCoverLetter'
import { PatchVersions } from '@/modules/patch/components/PatchVersions'
import { usePatch } from '@/modules/patch/queries'
import type { PatchId } from '@/modules/patch/schema'
import { DashboardHeader } from '@/screens/dashboard/components/dashboard-header'

export function PatchDetailScreen({ patchId }: { patchId: string }) {
  const patchResult = usePatch(patchId as PatchId)

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
    <div className="flex h-svh flex-col">
      <DashboardHeader title={patch.title} />

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
          <Tabs defaultValue="patches">
            <TabsList>
              <TabsTrigger value="patches">Patches</TabsTrigger>
              <TabsTrigger value="cover-letter">Cover Letter</TabsTrigger>
              <TabsTrigger value="jd">Job Description</TabsTrigger>
            </TabsList>

            <TabsContent value="patches" className="mt-6">
              {patch.status === 'generating' ? (
                <div className="flex h-96 w-full items-center justify-center rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
                    <p className="text-sm text-muted-foreground">
                      Generating tailored resume...
                    </p>
                  </div>
                </div>
              ) : (
                <PatchVersions patch={patch} />
              )}
            </TabsContent>

            <TabsContent value="cover-letter" className="mt-6">
              <PatchCoverLetter patch={patch} />
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
    </div>
  )
}
