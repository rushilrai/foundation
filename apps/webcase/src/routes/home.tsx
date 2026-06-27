import { createFileRoute } from '@tanstack/react-router'

import { authGuard } from '@/modules/auth/server'
import { HomeScreen } from '@/screens/home'

export const Route = createFileRoute('/home')({
  beforeLoad: () => authGuard(),
  component: HomeScreen,
})
