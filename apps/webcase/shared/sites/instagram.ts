// Instagram, the URL-only part. A profile or post that Instagram hides
// behind its login wall comes back titled "Login • Instagram" (or just
// "Instagram"), which names nothing, so those titles are stand-ins on an
// Instagram link. A profile's title then comes from its URL:
// instagram.com/fatlulus/ → "@fatlulus on Instagram". Posts and reels are
// read from their page as usual (convex/lib/metadata/sites/instagram.ts).

import { hostOf, pathSegments, type UrlRule } from './types'

const HOSTS: ReadonlySet<string> = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
])

// The login wall's titles.
export const INSTAGRAM_LOGIN_TITLES: ReadonlyArray<string> = [
  'Login • Instagram',
  'Instagram',
]

// First path segments that are Instagram's own pages, never a profile.
const RESERVED: ReadonlySet<string> = new Set([
  'p',
  'reel',
  'reels',
  'tv',
  'explore',
  'stories',
  'accounts',
  'direct',
  'about',
  'legal',
  'developer',
  'web',
  'api',
  'challenge',
  'oauth',
  'privacy',
  'terms',
])
// Instagram's username alphabet.
const HANDLE = /^[a-z0-9._]{1,30}$/i

export const isInstagramUrl = (url: URL): boolean => HOSTS.has(hostOf(url))

// The handle of a profile URL (instagram.com/<handle>/), or null.
const profileHandle = (url: URL): string | null => {
  const segments = pathSegments(url)
  const [handle] = segments
  return segments.length === 1 &&
    HANDLE.test(handle) &&
    /[a-z0-9]/i.test(handle) &&
    !RESERVED.has(handle.toLowerCase())
    ? handle
    : null
}

export const instagram: UrlRule = {
  name: 'Instagram',
  match: isInstagramUrl,
  title: (url) => {
    const handle = profileHandle(url)
    return handle ? `@${handle} on Instagram` : null
  },
  placeholderTitles: INSTAGRAM_LOGIN_TITLES,
}
