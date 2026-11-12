// Site resolvers: sites the generic page fetch reads badly, each with its
// own endpoint or fix-ups. Pure; read.ts runs them. To add one, write
// sites/<site>.ts exporting a `Site` and list it here. A title taken from
// the URL when nothing else gave one is a separate opt-in, URL_TITLE_SITES
// in shared/url.ts, because the browser needs it too.

import { googleMaps } from './googleMaps'
import { hackerNews } from './hackerNews'
import { npm } from './npm'
import { pinterest } from './pinterest'
import { reddit } from './reddit'
import { stackExchange } from './stackExchange'
import type { Site, SitePage } from './types'
import { x } from './x'
import { youtube } from './youtube'

const SITES: Array<Site> = [
  youtube,
  x,
  reddit,
  hackerNews,
  stackExchange,
  npm,
  pinterest,
  googleMaps,
]

export type SiteMatch = SitePage & {
  site: Site['name']
  provides: Site['provides']
}

// The site resolver for a link, or null when no site claims it.
export const matchSite = (url: URL): SiteMatch | null => {
  for (const site of SITES) {
    const page = site.match(url)
    if (page) {
      return { ...page, site: site.name, provides: site.provides }
    }
  }

  return null
}
