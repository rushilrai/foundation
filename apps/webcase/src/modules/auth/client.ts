import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// No baseURL: auth goes through this origin's /api/auth proxy, so the session
// cookie is first-party (Safari blocks third-party cookies).
export const authClient = createAuthClient({
  plugins: [convexClient()],
})
