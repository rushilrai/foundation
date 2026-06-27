import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardHeader } from '@/modules/common/components/DashboardHeader'
import { OriginalTab } from '@/modules/resume/components/OriginalTab'
import { PatchesTab } from '@/modules/resume/components/PatchesTab'
import { ResumeContentTab } from '@/modules/resume/components/ResumeContentTab'
import { useGenerateResumeDownloadUrl } from '@/modules/resume/mutations'
import { useResume } from '@/modules/resume/queries'
import type { ResumeId } from '@/modules/resume/schema'

export const Route = createFileRoute('/dashboard/resume/$id/')({
  component: ResumeDetailPage,
})

function ResumeDetailPage() {
  const { id } = Route.useParams()
  const resumeResult = useResume(id as ResumeId)
  const generateDownloadUrl = useGenerateResumeDownloadUrl()

  const handleDownload = async () => {
    const result = await generateDownloadUrl({ resumeId: id as ResumeId })
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

        <div className="p-6">
          <Skeleton className="h-[calc(100vh-200px)]" />
        </div>
      </>
    )
  }

  if ('error' in resumeResult) {
    return (
      <>
        <DashboardHeader title="Error" />

        <div className="p-6">
          <p className="text-destructive">
            {resumeResult.error === 'RESUME_NOT_FOUND'
              ? 'Resume not found.'
              : 'An error occurred while loading the resume.'}
          </p>
        </div>
      </>
    )
  }

  const { resume } = resumeResult

  return (
    <>
      <DashboardHeader title={resume.title}>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={handleDownload}
            disabled={resume.status !== 'ready'}
          >
            Download DOCX
          </Button>
        </div>
      </DashboardHeader>

      <div className="p-6">
        <Tabs defaultValue="original">
          <TabsList>
            <TabsTrigger value="original">Original</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="patches">Patches</TabsTrigger>
          </TabsList>

          <TabsContent value="original" className="mt-6">
            <OriginalTab resume={resume} />
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <ResumeContentTab resume={resume} />
          </TabsContent>

          <TabsContent value="patches" className="mt-6">
            <PatchesTab resumeId={resume._id} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
