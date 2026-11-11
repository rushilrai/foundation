import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from '@shared/auth'

import { env } from '@/env'

// Server only: the /api/auth proxy handler and the token for SSR requests.
const auth = convexBetterAuthReactStart({
  convexUrl: env.VITE_CONVEX_URL,
  convexSiteUrl: env.VITE_CONVEX_SITE_URL,
})

export const { getToken } = auth

// The browser's address as the host saw it. Vercel sets x-real-ip and
// x-forwarded-for itself, replacing any the browser sent.
const clientIp = (request: Request): string | undefined =>
  request.headers.get('x-real-ip')?.trim() ||
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  undefined

// Proxies to the Convex site, passing on the browser's address so Better
// Auth rate-limits each visitor rather than this server (shared/auth.ts).
export const handler = (request: Request): Promise<Response> => {
  const headers = new Headers(request.headers)
  headers.delete(CLIENT_IP_HEADER)
  headers.delete(PROXY_SECRET_HEADER)

  const secret = process.env.AUTH_PROXY_SECRET
  const ip = clientIp(request)
  if (secret && ip) {
    headers.set(CLIENT_IP_HEADER, ip)
    headers.set(PROXY_SECRET_HEADER, secret)
  }

  return auth.handler(
    new Request(request.url, {
      method: request.method,
      headers,
      body: request.body,
      // @ts-expect-error - Node's fetch needs `duplex` to stream a request body
      duplex: 'half',
    }),
  )
}
