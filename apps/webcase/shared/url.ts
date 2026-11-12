// URL rules shared by the browser and Convex: what counts as a link, the
// normalised form links are stored and matched by, and the display values
// derived from it. Pure, no I/O. Site rules (shared/sites) are consulted
// first; a link none matches gets the base rules here.

import { MAX_TITLE_LENGTH, MAX_URL_LENGTH } from './limits'
import { urlRuleFor } from './sites'
import { decodePath } from './sites/types'
import { YOUTU_BE_HOST, YOUTUBE_HOSTS } from './sites/youtube'

// Query parameters that only say where a click came from. They are dropped
// when a URL is normalised, so the same page shared twice (Pocket added
// `g_st` to every Maps link it saved) is one link. Only parameters that
// never change which page is served belong here: never `v`, `q`, `id`, `t`.
const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'igshid',
  'mc_cid',
  'mc_eid',
  // Google's share tracking, e.g. maps.app.goo.gl/…?g_st=com.ideashower.ReadItLaterPro
  'g_st',
])
// Every `utm_*` parameter is tracking.
const TRACKING_PREFIX = 'utm_'

// YouTube's share id (`?si=`) is tracking there, and only there.
const isTrackingParam = (name: string, hostname: string): boolean =>
  TRACKING_PARAMS.has(name) ||
  name.startsWith(TRACKING_PREFIX) ||
  (name === 'si' && (YOUTUBE_HOSTS.has(hostname) || hostname === YOUTU_BE_HOST))

// Drops tracking parameters. The others are kept exactly as written (not
// re-encoded), so a query the page depends on reaches it unchanged.
const stripTracking = (url: URL): void => {
  if (!url.search) {
    return
  }

  const pairs = url.search.slice(1).split('&')
  const kept = pairs.filter((pair) => {
    const raw = pair.split('=', 1)[0].replace(/\+/g, ' ')
    let name = raw
    try {
      name = decodeURIComponent(raw)
    } catch {
      // Keep the encoded name.
    }
    return !isTrackingParam(name.toLowerCase(), url.hostname)
  })

  if (kept.length !== pairs.length) {
    url.search = kept.length ? `?${kept.join('&')}` : ''
  }
}

// One URL as written, parsed and cleaned: http(s) only, no credentials,
// tracking parameters dropped, within the length limit. Null otherwise.
const parseOne = (raw: string): URL | null => {
  const value = raw.trim()
  if (!value || value.length > MAX_URL_LENGTH) {
    return null
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }
  if (!url.hostname || url.username || url.password) {
    return null
  }

  stripTracking(url)
  if (url.href.length > MAX_URL_LENGTH) {
    return null
  }

  return url
}

// A wrapper inside a wrapper is unwrapped too, this many times at most.
const MAX_REWRITES = 3

// Parses an http(s) URL. Returns null for anything else, including
// credentials in the URL, which are never needed to read a public page.
// `href` is the normalised form links are stored and matched by: lowercase
// host, no default port, `/` for an empty path, percent-encoding applied,
// tracking parameters (TRACKING_PARAMS) removed, and a redirect wrapper
// replaced by its destination (a site rule's `rewrite`, shared/sites), which
// passes the same checks; a destination that fails them leaves the wrapper.
// Other query parameters and the fragment are kept as given.
export const parseHttpUrl = (raw: string): URL | null => {
  let url = parseOne(raw)

  for (let step = 0; url && step < MAX_REWRITES; step++) {
    const destination = urlRuleFor(url)?.rewrite?.(url)
    const next = destination ? parseOne(destination) : null
    if (!next) {
      break
    }
    url = next
  }

  return url
}

// True when the link is a redirect wrapper that parseHttpUrl replaces by
// its destination: a link stored before wrappers were unwrapped.
export const isRewrittenUrl = (raw: string): boolean => {
  const literal = parseOne(raw)
  return !!literal && parseHttpUrl(raw)?.href !== literal.href
}

// Host shown next to a link: lowercase, without a leading "www.".
export const domainOf = (url: URL): string =>
  url.hostname.toLowerCase().replace(/^www\./, '')

// Host plus path, e.g. "example.com/blog/post": the title of a link whose
// page gave none, unless its site rule derives a better one from the URL.
export const hostPathTitle = (url: URL): string =>
  `${domainOf(url)}${decodePath(url.pathname).replace(/\/+$/, '')}`.slice(
    0,
    MAX_TITLE_LENGTH,
  )

// The title the link's own site rule puts in its URL (a rule's `title`,
// shared/sites), or null when no rule claims it or this URL holds none. A
// title from the URL is a per-site opt-in, never a generic guess:
// "uber.com/en-US/blog/engineering" is not a title called "En US".
export const urlTitle = (url: URL): string | null =>
  urlRuleFor(url)?.title?.(url)?.slice(0, MAX_TITLE_LENGTH) || null

// Title used when neither a site rule nor the page gave one: the title
// the site puts in its URL, else host plus path. The save sheet shows the
// same while the preview loads, so this is the one rule for both sides.
export const fallbackTitle = (url: URL): string =>
  urlTitle(url) ?? hostPathTitle(url)

// True when a stored title is only a stand-in for the URL (empty, the URL
// itself in any spelling, the bare domain, host and path, the site's own
// URL title, or a title the site gives pages that name nothing, such as
// "Google Maps" or Instagram's login wall), so enrichment may replace it.
// A wrapper link's own spellings count as well as its destination's. Any
// other sentence is a real title, even one that reads like the URL's slug
// ("Building effective agents").
export const isPlaceholderTitle = (title: string, rawUrl: string): boolean => {
  const value = title.trim()
  if (!value) {
    return true
  }

  const url = parseHttpUrl(rawUrl)
  const candidates = new Set([rawUrl.trim(), rawUrl.trim().replace(/\/+$/, '')])
  if (url) {
    // The same link with tracking parameters, another case or a trailing /.
    if (parseHttpUrl(value)?.href === url.href) {
      return true
    }
    for (const spelling of new Set([url, parseOne(rawUrl) ?? url])) {
      candidates.add(spelling.href)
      candidates.add(spelling.href.replace(/\/+$/, ''))
      candidates.add(
        spelling.href.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      )
      candidates.add(fallbackTitle(spelling))
      candidates.add(hostPathTitle(spelling))
      candidates.add(domainOf(spelling))
    }
    for (const placeholder of urlRuleFor(url)?.placeholderTitles ?? []) {
      candidates.add(placeholder)
    }
  }

  return candidates.has(value)
}
