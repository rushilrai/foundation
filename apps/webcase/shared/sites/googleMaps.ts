// Google Maps, the URL-only part: the place name in a long link's path, and
// the place in a `?q=` link (a short link's redirect target has this
// shape), split into its name and address. The network part (the short
// link's redirect, the page's titles) is convex/lib/metadata/sites/googleMaps.ts.

import { decodePath, hostOf, type UrlRule } from './types'

// google.<tld>, www. or maps. in front.
const GOOGLE_MAPS_HOST = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/
// Short links: maps.app.goo.gl/<code>. The older goo.gl/maps/<code> is
// not matched: goo.gl now answers them with an error and no redirect.
const SHORT_LINK_HOST = 'maps.app.goo.gl'

// The title Google Maps gives a page that names nothing.
export const GOOGLE_MAPS_TITLE = 'Google Maps'

export const isGoogleMapsHost = (url: URL): boolean =>
  GOOGLE_MAPS_HOST.test(hostOf(url))

export const isMapsShortLink = (url: URL): boolean =>
  hostOf(url) === SHORT_LINK_HOST && /^\/[\w-]+\/?$/.test(url.pathname)

// The place name in a long link, from the path segment after /maps/place/:
// ".../maps/place/Gateway+Of+India+Mumbai/@18.9,72.8,17z" → "Gateway Of
// India Mumbai". None for a dropped pin, whose "name" is only coordinates.
export const mapsPlaceName = (url: URL): string | null => {
  if (!isGoogleMapsHost(url)) {
    return null
  }
  const match = /^\/maps\/place\/([^/]+)/.exec(url.pathname)
  if (!match) {
    return null
  }

  const name = decodePath(match[1].replace(/\+/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  return /\p{L}{2}/u.test(name) ? name : null
}

// The `q` of a Maps search link: maps.google.com/?q=… or maps?q=…, and
// google.<tld>/maps?q=…. A short link redirects to one, e.g.
// "https://maps.google.com?q=Yasin's+Food+Inn,+Apna+Ghar,+…&ftid=…". Null
// for anything else, and for a dropped pin's bare coordinates.
export const mapsQuery = (url: URL): string | null => {
  const host = hostOf(url)
  if (!GOOGLE_MAPS_HOST.test(host)) {
    return null
  }
  const onMaps = host.startsWith('maps.')
    ? url.pathname === '/' || url.pathname === '/maps'
    : url.pathname === '/maps'
  const query = onMaps ? url.searchParams.get('q')?.trim() : undefined

  return query && /\p{L}{2}/u.test(query) ? query.replace(/\s+/g, ' ') : null
}

// An Open Location Code at the start of a part, as Maps puts it before a
// place without a street address: "3R3G+JMX Veronica's". In a query the
// "+" arrives as a space. Its alphabet has no vowels, so no word matches,
// and at least one letter is required.
const PLUS_CODE =
  /^(?=[2-9A-Z]*[CFGHJMPQRVWX])[23456789CFGHJMPQRVWX]{4,8}[+ ][23456789CFGHJMPQRVWX]{2,3}\s+/i

// Parts of an address before the place's name: a unit, floor, shop or
// plot ("SF - 090", "Ground Floor", "Shop No. 30/31", "119-A").
const UNIT_PART =
  /^(?:\d|(?:shop|unit|plot|gate|pillar|bungalow|building|flat|office|suite|no)\b|(?:sf|ff|gf|ug|lg)\b|.*\bfloor\b)/i

const normalizeName = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim()

export type MapsPlace = { name?: string; address?: string }

// Splits a Maps query into the place's name and its address. With the
// name the page gave (`knownName`), that part is removed wherever it
// appears, so the address is only the address; without one, the first
// part that isn't a unit or floor stands for the name. Plus codes are
// dropped. "SF - 090, First floor, Grotto - Pizzeria|Coffee Shop, Galleria
// Market, …" with "Grotto - Pizzeria|Coffee Shop" → address "SF - 090,
// First floor, Galleria Market, …".
export const splitMapsQuery = (
  query: string,
  knownName?: string,
): MapsPlace => {
  const parts = query
    .split(',')
    .map((part) => part.replace(PLUS_CODE, '').trim())
    .filter(Boolean)
  if (parts.length === 0) {
    return {}
  }

  const known = knownName ? normalizeName(knownName) : ''
  const index = known
    ? parts.findIndex((part) => normalizeName(part) === known)
    : parts.findIndex((part) => !UNIT_PART.test(part))
  const name = index === -1 ? undefined : parts[index]
  const rest = index === -1 ? parts : parts.filter((_, i) => i !== index)

  return {
    name: known ? undefined : name,
    address: rest.length ? rest.join(', ') : undefined,
  }
}

export const googleMaps: UrlRule = {
  name: 'Google Maps',
  match: (url) => isGoogleMapsHost(url) || isMapsShortLink(url),
  title: (url) => {
    const place = mapsPlaceName(url)
    if (place) {
      return place
    }
    const query = mapsQuery(url)
    return query ? (splitMapsQuery(query).name ?? null) : null
  },
  placeholderTitles: [GOOGLE_MAPS_TITLE],
}
