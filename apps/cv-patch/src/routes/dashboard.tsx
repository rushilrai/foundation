import { createFileRoute } from '@tanstack/react-router'

import { authGuard } from '@/modules/auth/server'
import { DashboardScreen } from '@/screens/dashboard'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    return await authGuard()
  },
  component: DashboardScreen,
})
