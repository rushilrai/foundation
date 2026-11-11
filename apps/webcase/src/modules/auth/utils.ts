import type { AuthSearch } from './schema'

const AUTH_PATHS = ['/sign-in', '/sign-up']

// Where signing in comes back to: a path on this site, never an auth page,
// else Home. Anything that could leave the origin (`//host`, `/\host`, a full
// URL) falls back to Home.
export function resolveRedirect(redirect: string | undefined) {
  if (!redirect?.startsWith('/') || /^\/[/\\]/.test(redirect)) return '/'

  const [pathname] = redirect.split(/[?#]/, 1)
  if (AUTH_PATHS.includes(pathname)) return '/'

  return redirect
}

// The search an auth page carries to come back to `href`; empty for Home.
export function authSearch(href: string): AuthSearch {
  const redirect = resolveRedirect(href)

  return redirect === '/' ? {} : { redirect }
}
