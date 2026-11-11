import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'

import { requireSignedIn } from '@/modules/auth/guards'
import { currentUserQuery } from '@/modules/auth/queries'
import { homeSearchSchema } from '@/modules/link/schema'
import { HomeScreen } from '@/screens/home'

export const Route = createFileRoute('/')({
  validateSearch: homeSearchSchema,
  beforeLoad: requireSignedIn,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(currentUserQuery),
  component: HomeRoute,
})

function HomeRoute() {
  const { tag } = Route.useSearch()
  const navigate = Route.useNavigate()

  // Each filter change is a history entry, so Back returns to the last one.
  const setTag = useCallback(
    (next: string | null) =>
      void navigate({
        search: (prev) => ({ ...prev, tag: next ?? undefined }),
      }),
    [navigate],
  )

  return <HomeScreen tag={tag} onTagChange={setTag} />
}
