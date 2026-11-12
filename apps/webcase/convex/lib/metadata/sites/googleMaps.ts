// A long Google Maps link's page is titled "Google Maps" whatever the
// place, so that title is dropped and the place name in the URL
// (its entry in URL_TITLE_SITES, shared/url.ts) stands in. Short links (maps.app.goo.gl,
// g.co/kgs) aren't matched: their pages name the place.

import { mapsPlaceName } from '../../../../shared/url'
import { type Site } from './types'

export const googleMaps: Site = {
  name: 'Google Maps',
  provides: { description: false, image: false },
  match: (url) =>
    mapsPlaceName(url)
      ? {
          domain: url.hostname.toLowerCase().replace(/^www\./, ''),
          cleanPage: (metadata) =>
            metadata.title === 'Google Maps'
              ? { ...metadata, title: undefined }
              : metadata,
        }
      : null,
}
