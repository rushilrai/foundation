import { createFileRoute } from '@tanstack/react-router'

import { ProfileDetailScreen } from '@/screens/profile-detail'

export const Route = createFileRoute('/dashboard/profile/$id/')({
  component: ProfileDetailRoute,
})

function ProfileDetailRoute() {
  const { id } = Route.useParams()

  return <ProfileDetailScreen profileId={id} />
}
