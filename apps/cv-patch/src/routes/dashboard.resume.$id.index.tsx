import { createFileRoute } from '@tanstack/react-router'

import { ResumeDetailScreen } from '@/screens/resume-detail'

export const Route = createFileRoute('/dashboard/resume/$id/')({
  component: ResumeDetailRoute,
})

function ResumeDetailRoute() {
  const { id } = Route.useParams()

  return <ResumeDetailScreen resumeId={id} />
}
