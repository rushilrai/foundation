import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

import { env } from '@/env'

// Server only: the /api/auth proxy handler and the token for SSR requests.
export const { handler, getToken } = convexBetterAuthReactStart({
  convexUrl: env.VITE_CONVEX_URL,
  convexSiteUrl: env.VITE_CONVEX_SITE_URL,
})
