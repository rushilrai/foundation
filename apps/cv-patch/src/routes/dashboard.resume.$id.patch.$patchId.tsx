import { createFileRoute } from '@tanstack/react-router'

import { PatchDetailScreen } from '@/screens/patch-detail'

export const Route = createFileRoute('/dashboard/resume/$id/patch/$patchId')({
  component: PatchDetailRoute,
})

function PatchDetailRoute() {
  const { patchId } = Route.useParams()

  return <PatchDetailScreen patchId={patchId} />
}
