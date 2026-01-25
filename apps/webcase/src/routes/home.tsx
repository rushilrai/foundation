import { SignOutButton } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const authGuard = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()
  if (!userId) {
    throw redirect({ to: '/sign-in/$' })
  }
  return { userId }
})

export const Route = createFileRoute('/home')({
  beforeLoad: () => authGuard(),
  component: HomePage,
})

function HomePage() {
  return (
    <div>
      <h1>Welcome to your dashboard</h1>

      <SignOutButton />
    </div>
  )
}
