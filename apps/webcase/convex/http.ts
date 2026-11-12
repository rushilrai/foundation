import { httpRouter } from 'convex/server'

import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from '../shared/auth'
import { authComponent, createAuth } from './auth'

const http = httpRouter()

// Compares without stopping at the first difference, so the time taken
// says nothing about how much of a guess was right.
const sameSecret = (a: string, b: string): boolean => {
  let difference = a.length ^ b.length
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0)
  }
  return difference === 0
}

// Better Auth's rate limit keys on x-forwarded-for, which Convex sets from
// the connection (a value the caller sends is replaced). For a request from
// the app's /api/auth proxy that is the app server, so the browser's own
// address, which the proxy vouches for with the shared secret, takes its
// place (see shared/auth.ts). Without the secret the header is ignored.
const withClientIp = (request: Request): Request => {
  const secret = process.env.AUTH_PROXY_SECRET
  const sent = request.headers.get(PROXY_SECRET_HEADER)
  const clientIp = request.headers.get(CLIENT_IP_HEADER)?.trim()
  if (!sent && !clientIp) {
    return request
  }

  const headers = new Headers(request.headers)
  headers.delete(PROXY_SECRET_HEADER)
  headers.delete(CLIENT_IP_HEADER)
  if (secret && sent && clientIp && sameSecret(sent, secret)) {
    headers.set('x-forwarded-for', clientIp)
  }

  return new Request(request, { headers })
}

authComponent.registerRoutes(http, (ctx) => {
  const auth = createAuth(ctx)
  const { handler } = auth
  auth.handler = (request) => handler(withClientIp(request))
  return auth
})

export default http
