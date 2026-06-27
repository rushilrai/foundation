import { SignIn } from '@clerk/tanstack-react-start'

export function SignInScreen() {
  return (
    <div>
      <SignIn forceRedirectUrl="/home" />
    </div>
  )
}
