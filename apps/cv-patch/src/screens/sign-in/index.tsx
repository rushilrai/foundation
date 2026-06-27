import { SignIn } from '@clerk/tanstack-react-start'

export function SignInScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <SignIn forceRedirectUrl="/dashboard/home" />
    </div>
  )
}
