import type { AuthSearch } from './schema'

const AUTH_PATHS = ['/sign-in', '/sign-up']

// A fixed stand-in origin, so the check runs the same on the server (no
// `window`) and in the browser. Never used for navigation.
const BASE = 'https://webcase.invalid'

// C0 controls, DEL and backslashes: browsers drop or reinterpret them
// while resolving a URL.
const hasUnsafeCharacter = (value: string) =>
  [...value].some((char) => {
    const code = char.charCodeAt(0)
    return code < 0x20 || code === 0x7f || char === '\\'
  })

// Where signing in comes back to: a path on this site, never an auth page,
// else Home. The value is resolved the way a browser would resolve it
// against this origin and must stay on it, so `//host`, `/\host`, `/\t/host`
// (browsers drop tabs and newlines) and full URLs all fall back to Home.
export function resolveRedirect(redirect: string | undefined) {
  // Control characters and backslashes are never part of a path we create.
  if (!redirect?.startsWith('/') || hasUnsafeCharacter(redirect)) return '/'

  let url: URL
  try {
    url = new URL(redirect, BASE)
  } catch {
    return '/'
  }
  if (url.origin !== BASE) return '/'
  if (AUTH_PATHS.includes(url.pathname)) return '/'

  return `${url.pathname}${url.search}${url.hash}`
}

// The search an auth page carries to come back to `href`; empty for Home.
export function authSearch(href: string): AuthSearch {
  const redirect = resolveRedirect(href)

  return redirect === '/' ? {} : { redirect }
}
