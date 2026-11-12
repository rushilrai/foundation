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

const decodePath = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

// Host plus path, e.g. "example.com/blog/post": the last resort when the
// URL holds nothing more readable. Links saved before the readable
// fallbacks below carry it as their title.
export const hostPathTitle = (url: URL): string =>
  `${domainOf(url)}${decodePath(url.pathname).replace(/\/+$/, '')}`.slice(
    0,
    MAX_TITLE_LENGTH,
  )

// Google Maps' own hosts: google.<tld>, www. or maps. in front.
const GOOGLE_MAPS_HOST = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/

// The place name in a long Google Maps link, from the path segment after
// /maps/place/: ".../maps/place/Gateway+Of+India+Mumbai/@18.9,72.8,17z" →
// "Gateway Of India Mumbai". Null for any other URL, and for a dropped pin
// whose "name" is only coordinates. Short links (maps.app.goo.gl) have no
// name in them and are read from the page instead.
export const mapsPlaceName = (url: URL): string | null => {
  if (!GOOGLE_MAPS_HOST.test(url.hostname.toLowerCase())) {
    return null
  }
  const match = /^\/maps\/place\/([^/]+)/.exec(url.pathname)
  if (!match) {
    return null
  }

  const name = decodePath(match[1].replace(/\+/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (!/\p{L}{2}/u.test(name)) {
    return null
  }

  return name.slice(0, MAX_TITLE_LENGTH)
}

// A path segment's file extension, dropped from a slug.
const PAGE_EXTENSION = /\.(?:html?|php|aspx?|jsp)$/i
// The last token of a slug when it is an id rather than a word: Medium's
// "3a896f9f4c09", dev.to's "3dif", a long number.
const isIdToken = (token: string): boolean =>
  (/^\d{5,}$/.test(token) ||
    (/\d/.test(token) && /^[a-z0-9]{4,}$/i.test(token))) &&
  !/^\d{4}$/.test(token)

// A locale segment ("en-US", "pt_BR") looks like a two-word slug and names
// nothing about the page.
const LOCALE_SEGMENT = /^[a-z]{2,3}[-_][a-z]{2,4}$/i

// Words in a slug segment ("what-flutter-apps-3a896f9f"), or null when it
// isn't a slug of at least three real words (two letters or more each): two
// words are too often a section or a locale, and "En US" is a worse title
// than the host and path.
const slugWords = (segment: string): Array<string> | null => {
  const value = decodePath(segment).replace(PAGE_EXTENSION, '')
  if (!/[-_]/.test(value) || LOCALE_SEGMENT.test(value)) {
    return null
  }

  const tokens = value.split(/[-_]+/).filter(Boolean)
  if (tokens.length > 1 && isIdToken(tokens[tokens.length - 1])) {
    tokens.pop()
  }
  const words = tokens.filter((token) => /^\p{L}{2,}(?:'\p{L}+)?$/u.test(token))

  return words.length >= 3 ? tokens : null
}

// A readable title from the URL's last meaningful path segment, for pages
// that can't be read: "medium.com/@x/what-flutter-apps-are-missing-to-look-
// feel-native-on-android-3a896f9f4c09" → "What flutter apps are missing to
// look feel native on android". Null when no segment is a slug of at least
// three words ("amazon.in/dp/B08N5WRWNW").
export const slugTitle = (url: URL): string | null => {
  const segments = url.pathname.split('/').filter(Boolean)

  for (let index = segments.length - 1; index >= 0; index--) {
    const tokens = slugWords(segments[index])
    if (!tokens) {
      continue
    }

    let text = tokens.join(' ')
    // A slug in one case reads best in sentence case; mixed case was
    // written that way on purpose.
    if (text === text.toLowerCase() || text === text.toUpperCase()) {
      text = text.toLowerCase()
    }

    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`.slice(
      0,
      MAX_TITLE_LENGTH,
    )
  }

  return null
}

// Title used when a page gives us nothing: a Maps place's name, else a
// readable slug, else host plus path. The save sheet shows the same while
// the preview loads, so this is the one rule for both sides.
export const fallbackTitle = (url: URL): string =>
  mapsPlaceName(url) ?? slugTitle(url) ?? hostPathTitle(url)

// The title Google Maps gives every long link's page, which names nothing.
const GOOGLE_MAPS_TITLE = 'Google Maps'

// True when a stored title is only a stand-in for the URL (empty, the URL
// itself in any spelling, our fallback or the older host-and-path one, or
// "Google Maps" on a long Maps link), so enrichment may replace it.
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
    candidates.add(hostPathTitle(url))
    candidates.add(domainOf(url))
    if (mapsPlaceName(url)) {
      candidates.add(GOOGLE_MAPS_TITLE)
    }
  }

  return candidates.has(value)
}
