import { createFileRoute } from '@tanstack/react-router'

import { requireSignedIn } from '@/modules/auth/guards'
import { currentUserQuery } from '@/modules/auth/queries'
import { HomeScreen } from '@/screens/home'

export const Route = createFileRoute('/')({
  beforeLoad: requireSignedIn,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(currentUserQuery),
  component: HomeScreen,
})
