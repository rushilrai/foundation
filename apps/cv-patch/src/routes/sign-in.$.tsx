import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sign-in/$')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <div className="h-full w-full flex flex-col justify-center items-center">
      <SignIn forceRedirectUrl="/dashboard/home" />
    </div>
  )
}
