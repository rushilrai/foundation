import { SignOutButton } from '@clerk/tanstack-react-start'

export function HomeScreen() {
  return (
    <div>
      <h1>Welcome to your dashboard</h1>

      <SignOutButton />
    </div>
  )
}
