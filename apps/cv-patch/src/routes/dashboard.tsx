import { auth } from '@clerk/tanstack-react-start/server'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { DashboardLayout } from '@/modules/common/components/DashboardLayout'

const authGuard = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()

  if (!userId) {
    throw redirect({ to: '/sign-in/$' })
  }

  return { userId }
})

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    return await authGuard()
  },
  component: DashboardLayoutRoute,
})

function DashboardLayoutRoute() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  )
}
