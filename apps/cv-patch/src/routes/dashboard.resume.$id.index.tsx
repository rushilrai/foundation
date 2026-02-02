import { api } from '@convex/_generated/api.js'
import type { Id } from '@convex/_generated/dataModel.js'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useAction } from 'convex/react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { DashboardHeader } from '@/modules/common/components/DashboardHeader'
import { OriginalTab } from '@/modules/resume/components/OriginalTab'
import { PatchesTab } from '@/modules/resume/components/PatchesTab'

export const Route = createFileRoute('/dashboard/resume/$id/')({
  component: ResumeDetailPage,
})

function ResumeDetailPage() {
  const { id } = Route.useParams()
  const resumeResult = useQuery(api.modules.resume.queries.get, {
    resumeId: id as Id<'resumes'>,
  })
  const generateDownloadUrl = useAction(
    api.modules.resume.actions.generateDownloadUrl,
  )

  const handleDownload = async () => {
    const result = await generateDownloadUrl({ resumeId: id as Id<'resumes'> })
    if ('downloadUrl' in result) {
      window.open(result.downloadUrl, '_blank')
    }
  }

  if (resumeResult === undefined) {
    return (
      <>
        <DashboardHeader>
          <Skeleton className="h-6 w-48" />
        </DashboardHeader>

        <main className="p-6">
          <Skeleton className="h-[calc(100vh-200px)]" />
        </main>
      </>
    )
  }

  if ('error' in resumeResult) {
    return (
      <>
        <DashboardHeader title="Error" />

        <main className="p-6">
          <p className="text-destructive">
            {resumeResult.error === 'RESUME_NOT_FOUND'
              ? 'Resume not found.'
              : 'An error occurred while loading the resume.'}
          </p>
        </main>
      </>
    )
  }

  const { resume } = resumeResult

  return (
    <>
      <DashboardHeader title={resume.title}>
        <Button variant="default" size="sm" onClick={handleDownload}>
          Download Original
        </Button>
      </DashboardHeader>

      <main className="p-6">
        <Tabs defaultValue="original">
          <TabsList>
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="patches">Patches</TabsTrigger>
          </TabsList>

          <TabsContent value="original" className="mt-6">
            <OriginalTab resume={resume} />
          </TabsContent>

          <TabsContent value="patches" className="mt-6">
            <PatchesTab resumeId={resume._id} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  )
}
