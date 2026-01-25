import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { createFileRoute, Link, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: IndexRouteComponent,
})

function IndexRouteComponent() {
  return (
    <>
      <SignedOut>
        <div>
          <h1>Welcome to WebCase</h1>
          <p>Your app description here</p>
          <Link to="/sign-in/$">Sign In</Link>
        </div>
      </SignedOut>

      <SignedIn>
        <Navigate to="/home" />
      </SignedIn>
    </>
  )
}
