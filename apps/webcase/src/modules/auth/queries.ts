import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useSuspenseQuery } from '@tanstack/react-query'

export const currentUserQuery = convexQuery(
  api.modules.auth.queries.currentUser,
  {},
)

// The signed-in user's name and email. Load `currentUserQuery` in the route
// loader so it renders on the server.
export function useCurrentUser() {
  const { data } = useSuspenseQuery(currentUserQuery)

  return 'user' in data ? data.user : null
}
