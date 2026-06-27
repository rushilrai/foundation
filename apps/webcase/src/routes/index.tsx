import { createFileRoute } from '@tanstack/react-router'

import { LandingScreen } from '@/screens/landing'

export const Route = createFileRoute('/')({
  component: LandingScreen,
})
