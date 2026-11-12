// Google Maps, the network part (the URL-only part is
// shared/sites/googleMaps.ts). A long link's page is titled "Google Maps"
// whatever the place, so that title is dropped and the place name in the
// URL stands in. A short link (maps.app.goo.gl/<code>) redirects to
// maps.google.com/?q=<name, address>&ftid=…, whose page Google serves in
// one of two shapes per place: rich ("Name · 4.1★(7506) · Restaurant",
// the address as og:description) or thin ("Name · City, State", no
// description). The thin shape gets the address from the redirect's `q`
// (fromUrl), without the name and plus code; the rich one is left as it
// is. A `?q=` link saved directly is read the same way.

import {
  GOOGLE_MAPS_TITLE,
  isGoogleMapsHost,
  isMapsShortLink,
  mapsPlaceName,
  mapsQuery,
  splitMapsQuery,
} from '../../../../shared/sites/googleMaps'
import type { Site, SitePage } from './types'

const cleanTitle = (title: string): string | undefined =>
  title.trim() === GOOGLE_MAPS_TITLE ? undefined : title

// The place from the first Maps search URL among the redirects (the link
// itself first). The page's title, "Name · …", names the place, so its
// name is taken out of the address; with no title, the query's name part
// is the title.
const fromQuery: SitePage['fromUrl'] = (redirects, read) => {
  const query = redirects.map(mapsQuery).find(Boolean)
  if (!query) {
    return null
  }

  const known = read.title?.split(' · ')[0]?.trim()
  const { name, address } = splitMapsQuery(query, known || undefined)
  return { title: known ? undefined : name, description: address }
}

export const googleMaps: Site = {
  name: 'Google Maps',
  match: (url) => {
    if (isMapsShortLink(url)) {
      return {
        domain: 'google.com',
        provides: { description: true, image: false },
        cleanTitle,
        fromUrl: fromQuery,
      }
    }
    if (!isGoogleMapsHost(url)) {
      return null
    }
    const domain = url.hostname.toLowerCase().replace(/^www\./, '')
    if (mapsPlaceName(url)) {
      return {
        domain,
        provides: { description: false, image: false },
        cleanTitle,
      }
    }
    if (mapsQuery(url)) {
      return {
        domain,
        provides: { description: true, image: false },
        cleanTitle,
        fromUrl: fromQuery,
      }
    }
    return null
  },
}
