// Google's "share this place" links from Search, g.co/kgs/<code>. They
// redirect to google.com/search?…&q=<name>, then on to a page that Google
// often answers with a bot check, or titles "<name> : Google Search". The
// suffix is dropped, and when the page gave no title the name comes from
// the redirect's `q` (fromUrl).

import { hostOf, type Site } from './types'

const SHARE_PATH = /^\/kgs\/[\w-]{1,20}\/?$/
const SEARCH_SUFFIX = /\s+[:\-–|]\s+Google Search$/
const GOOGLE_HOST = /^(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/
// The search pages a share link passes through.
const SEARCH_PATHS = new Set(['/search', '/knowledgegraphshares'])

const cleanTitle = (title: string): string | undefined => {
  const value = title.trim()
  return value === 'Google Search'
    ? undefined
    : value.replace(SEARCH_SUFFIX, '').trim() || undefined
}

const searchQuery = (url: URL): string | null =>
  GOOGLE_HOST.test(hostOf(url)) && SEARCH_PATHS.has(url.pathname)
    ? (url.searchParams.get('q')?.replace(/\s+/g, ' ').trim() ?? null)
    : null

export const googleShare: Site = {
  name: 'Google share',
  match: (url) =>
    hostOf(url) === 'g.co' && SHARE_PATH.test(url.pathname)
      ? {
          domain: 'google.com',
          provides: { description: false, image: false },
          cleanTitle,
          fromUrl: (redirects, read) => {
            if (read.title) {
              return null
            }
            const name = redirects.map(searchQuery).find(Boolean)
            return name && /\p{L}/u.test(name) ? { title: name } : null
          },
        }
      : null,
}
