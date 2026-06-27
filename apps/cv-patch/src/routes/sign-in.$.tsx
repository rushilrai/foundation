import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-in/$')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <SignIn forceRedirectUrl="/dashboard/home" />
    </div>
  )
}
