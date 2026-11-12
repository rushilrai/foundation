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

// Host plus path, e.g. "example.com/blog/post": the title of a link whose
// page gave none, unless its site derives a better one from the URL
// (URL_TITLE_SITES below).
export const hostPathTitle = (url: URL): string =>
  `${domainOf(url)}${decodePath(url.pathname).replace(/\/+$/, '')}`.slice(
    0,
    MAX_TITLE_LENGTH,
  )

// Titles from the URL, per site ----------------------------------------------
//
// A URL-derived title is a per-site opt-in, never a generic guess: a slug
// reads as a sentence only where someone has checked that the site puts
// the title there ("uber.com/en-US/blog/engineering" is not a title
// called "En US"). Each entry recognises its site from the URL (`match`)
// and pulls the title out of it (`title`, null when this URL holds none).
// It is used only when neither a site resolver nor the page gave a title.
// To add a site, write its entry and list it in URL_TITLE_SITES.
type UrlTitleSite = {
  name: string
  match: (url: URL) => boolean
  title: (url: URL) => string | null
}

const pathSegments = (url: URL): Array<string> =>
  url.pathname.split('/').filter(Boolean)

// Google Maps: google.<tld>, www. or maps. in front.
const GOOGLE_MAPS_HOST = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/

// The place name in a long link, from the path segment after /maps/place/:
// ".../maps/place/Gateway+Of+India+Mumbai/@18.9,72.8,17z" → "Gateway Of
// India Mumbai". None for a dropped pin, whose "name" is only coordinates.
// Short links (maps.app.goo.gl) have no name in them and are read from the
// page instead.
const googleMaps: UrlTitleSite = {
  name: 'Google Maps',
  match: (url) => GOOGLE_MAPS_HOST.test(url.hostname.toLowerCase()),
  title: (url) => {
    const match = /^\/maps\/place\/([^/]+)/.exec(url.pathname)
    if (!match) {
      return null
    }

    const name = decodePath(match[1].replace(/\+/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
    return /\p{L}{2}/u.test(name) ? name : null
  },
}

// Medium publications on their own domains that keep Medium's article
// URLs (/<slug>-<hex id>). Only domains checked to still serve them: their
// /feed lists articles in that shape. betterprogramming.pub (moved to
// medium.com/better-programming), towardsdatascience.com and
// medium.freecodecamp.org (left Medium) are not.
const MEDIUM_PUBLICATION_HOSTS: ReadonlySet<string> = new Set([
  'blog.devgenius.io',
  'levelup.gitconnected.com',
  'javascript.plainenglish.io',
  'python.plainenglish.io',
  'uxdesign.cc',
  'itnext.io',
  'proandroiddev.com',
])

// Medium's post id, the end of every article slug: 10 to 12 hex digits.
// Requiring a digit keeps a long word made of a–f out.
const MEDIUM_POST_ID = /^(?=[a-z]*\d)[0-9a-f]{10,12}$/

// An article slug, "what-flutter-apps-are-missing-3a896f9f4c09" → "What
// flutter apps are missing"; null for anything without the post id
// (profiles, tags, /about).
const mediumSlugTitle = (segment: string): string | null => {
  const tokens = decodePath(segment).split('-').filter(Boolean)
  if (tokens.length < 2 || !MEDIUM_POST_ID.test(tokens[tokens.length - 1])) {
    return null
  }

  const text = tokens.slice(0, -1).join(' ')
  return /\p{L}/u.test(text)
    ? `${text.charAt(0).toUpperCase()}${text.slice(1)}`
    : null
}

// Medium articles: medium.com/<@user or publication>/<slug>-<id>, and
// <name>.medium.com/<slug>-<id> or <publication host>/<slug>-<id>.
const medium: UrlTitleSite = {
  name: 'Medium',
  match: (url) => {
    const host = domainOf(url)
    return (
      host === 'medium.com' ||
      host.endsWith('.medium.com') ||
      MEDIUM_PUBLICATION_HOSTS.has(host)
    )
  },
  title: (url) => {
    const segments = pathSegments(url)
    const onMedium = domainOf(url) === 'medium.com'
    return segments.length === (onMedium ? 2 : 1)
      ? mediumSlugTitle(segments[segments.length - 1])
      : null
  },
}

const URL_TITLE_SITES: Array<UrlTitleSite> = [googleMaps, medium]

const titleOn = (site: UrlTitleSite, url: URL): string | null =>
  site.match(url) ? site.title(url)?.slice(0, MAX_TITLE_LENGTH) || null : null

// The title the link's own site puts in its URL, or null when no site in
// URL_TITLE_SITES claims it or this URL holds none.
const urlTitle = (url: URL): string | null => {
  const site = URL_TITLE_SITES.find((candidate) => candidate.match(url))
  return site ? titleOn(site, url) : null
}

// A long Google Maps link's place name, or null for any other URL. The
// Maps site resolver (convex/lib/metadata/sites) matches on it.
export const mapsPlaceName = (url: URL): string | null =>
  titleOn(googleMaps, url)

// Title used when neither a site resolver nor the page gave one: the
// title the site puts in its URL (URL_TITLE_SITES), else host plus path.
// The save sheet shows the same while the preview loads, so this is the
// one rule for both sides.
export const fallbackTitle = (url: URL): string =>
  urlTitle(url) ?? hostPathTitle(url)

// The title Google Maps gives every long link's page, which names nothing.
const GOOGLE_MAPS_TITLE = 'Google Maps'

// True when a stored title is only a stand-in for the URL (empty, the URL
// itself in any spelling, the bare domain, host and path, the site's own
// URL title, or "Google Maps" on a long Maps link), so enrichment may
// replace it. Any other sentence is a real title, even one that reads like
// the URL's slug ("Building effective agents").
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
