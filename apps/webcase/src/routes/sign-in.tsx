import { createFileRoute } from '@tanstack/react-router'

import { redirectSignedIn } from '@/modules/auth/guards'
import { authSearchSchema } from '@/modules/auth/schema'
import { SignInScreen } from '@/screens/sign-in'

export const Route = createFileRoute('/sign-in')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectSignedIn,
  head: () => ({ meta: [{ title: 'Sign in · Webcase' }] }),
  component: SignInRoute,
})

function SignInRoute() {
  const { redirect } = Route.useSearch()

  return <SignInScreen redirect={redirect} />
}
