// Redirect wrappers: links that only send the click on to another page,
// named in their own query. The link is the destination: it is stored,
// matched and read as that page (rewrite), so the same page saved
// directly is the same link, and the wrapper's expiring token is dropped.
// The destination is validated like any typed link and fetched through
// the same guard, so a wrapper pointing at a private address is blocked.
//
// Each entry was checked with a live request: out.reddit.com (in the
// owner's Pocket export), Facebook's l.php (302 to its "leaving Facebook"
// page for `u`), Google's /url ("Redirect Notice" linking `q` or `url`)
// and href.li (a refresh to the query). l.instagram.com is not listed: it
// sends a request without its signed token to instagram.com, so its shape
// could not be confirmed.

import { hostOf, type UrlRule } from './types'

type Wrapper = {
  hosts: ReadonlySet<string>
  // Path the wrapper serves, or null for any path.
  path: RegExp | null
  // Query parameters that may hold the destination, in order; null when
  // the whole query is the destination (href.li/?https://…).
  params: ReadonlyArray<string> | null
}

const WRAPPERS: ReadonlyArray<Wrapper> = [
  // https://out.reddit.com/t3_<id>?url=<destination>&token=…
  { hosts: new Set(['out.reddit.com']), path: null, params: ['url'] },
  // https://l.facebook.com/l.php?u=<destination>&h=…
  {
    hosts: new Set(['l.facebook.com', 'lm.facebook.com']),
    path: /^\/l\.php$/,
    params: ['u'],
  },
  // https://www.google.com/url?q=<destination>&sa=D, or ?url=
  {
    hosts: new Set(['google.com', 'www.google.com']),
    path: /^\/url$/,
    params: ['q', 'url'],
  },
  // https://href.li/?https://example.com/
  { hosts: new Set(['href.li']), path: /^\/$/, params: null },
]

const wrapperOf = (url: URL): Wrapper | null =>
  WRAPPERS.find(
    ({ hosts, path }) =>
      hosts.has(hostOf(url)) && (!path || path.test(url.pathname)),
  ) ?? null

// The destination as written, or null when there is none. Only absolute
// http(s) URLs count: anything else leaves the wrapper as the link.
const destinationOf = (url: URL): string | null => {
  const wrapper = wrapperOf(url)
  if (!wrapper) {
    return null
  }

  let value: string | null = null
  if (wrapper.params) {
    for (const param of wrapper.params) {
      value = url.searchParams.get(param)
      if (value) {
        break
      }
    }
  } else {
    // The query as written: a destination with its own query keeps it.
    value = url.search.slice(1)
  }

  const destination = value?.trim()
  return destination && /^https?:\/\//i.test(destination) ? destination : null
}

export const redirectWrappers: UrlRule = {
  name: 'Redirect wrappers',
  match: (url) => !!wrapperOf(url),
  rewrite: destinationOf,
}
