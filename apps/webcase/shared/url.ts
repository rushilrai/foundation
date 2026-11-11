// URL rules shared by the browser and Convex: what counts as a link, the
// normalised form links are stored and matched by, and the display values
// derived from it. Pure, no I/O.

import { MAX_TITLE_LENGTH, MAX_URL_LENGTH } from './limits'

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
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
])

const isTrackingParam = (name: string, hostname: string): boolean =>
  TRACKING_PARAMS.has(name) ||
  name.startsWith(TRACKING_PREFIX) ||
  (name === 'si' && YOUTUBE_HOSTS.has(hostname))

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

// Parses an http(s) URL. Returns null for anything else, including
// credentials in the URL, which are never needed to read a public page.
// `href` is the normalised form links are stored and matched by: lowercase
// host, no default port, `/` for an empty path, percent-encoding applied,
// tracking parameters (TRACKING_PARAMS) removed. Other query parameters and
// the fragment are kept as given.
export const parseHttpUrl = (raw: string): URL | null => {
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

// Host shown next to a link: lowercase, without a leading "www.".
export const domainOf = (url: URL): string =>
  url.hostname.toLowerCase().replace(/^www\./, '')

// Title used when a page gives us nothing: host plus path, e.g.
// "example.com/blog/post".
export const fallbackTitle = (url: URL): string => {
  let path = url.pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    // Keep the encoded path.
  }
  path = path.replace(/\/+$/, '')

  return `${domainOf(url)}${path}`.slice(0, MAX_TITLE_LENGTH)
}

// True when a stored title is only a stand-in for the URL (empty, the URL
// itself in any spelling, or our fallback), so enrichment may replace it.
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
    candidates.add(url.href)
    candidates.add(url.href.replace(/\/+$/, ''))
    candidates.add(url.href.replace(/^https?:\/\//, '').replace(/\/+$/, ''))
    candidates.add(fallbackTitle(url))
    candidates.add(domainOf(url))
  }

  return candidates.has(value)
}
