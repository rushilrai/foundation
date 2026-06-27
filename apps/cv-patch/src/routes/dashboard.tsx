import { createFileRoute, Outlet } from '@tanstack/react-router'

import { authGuard } from '@/modules/auth/server'
import { DashboardLayout } from '@/modules/common/components/DashboardLayout'

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
