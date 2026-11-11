import { createFileRoute } from '@tanstack/react-router'

import { redirectSignedIn } from '@/modules/auth/guards'
import { authSearchSchema } from '@/modules/auth/schema'
import { SignUpScreen } from '@/screens/sign-up'

export const Route = createFileRoute('/sign-up')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectSignedIn,
  head: () => ({ meta: [{ title: 'Create account · Webcase' }] }),
  component: SignUpRoute,
})

function SignUpRoute() {
  const { redirect } = Route.useSearch()

  return <SignUpScreen redirect={redirect} />
}
