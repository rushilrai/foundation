import { convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useQuery } from '@tanstack/react-query'

export const linksQuery = convexQuery(api.modules.link.queries.list, {})

// The signed-in user's whole library, newest saved first, kept live by the
// Convex subscription. Not loaded on the server: dates render on the client
// only, and a large library would bloat the page.
export function useLinks() {
  return useQuery(linksQuery)
}
