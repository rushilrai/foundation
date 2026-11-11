import { createFileRoute } from '@tanstack/react-router'

import { handler } from '@/modules/auth/server'

// Proxies Better Auth to the Convex site through this origin, so the session
// cookie is first-party.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
})
