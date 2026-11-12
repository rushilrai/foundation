import { redirect, type ParsedLocation } from '@tanstack/react-router'

import { authSearch, resolveRedirect } from './utils'

type GuardArgs = {
  context: { isAuthenticated: boolean }
  location: ParsedLocation
}

// For a signed-in-only route's beforeLoad: signed-out visitors go to sign-in
// and come back here afterwards.
export function requireSignedIn({ context, location }: GuardArgs) {
  if (context.isAuthenticated) return

  throw redirect({ to: '/sign-in', search: authSearch(location.href) })
}

// For the auth pages' beforeLoad: signed-in visitors go where they were headed.
export function redirectSignedIn({
  context,
  search,
}: {
  context: { isAuthenticated: boolean }
  search: { redirect?: string }
}) {
  if (!context.isAuthenticated) return

  throw redirect({ href: resolveRedirect(search.redirect) })
}
