// The network parts of the site rules (see types.ts), one file per site.
// read.ts consults them before reading a link; a link no rule matches is
// left to the base workflow. To add one, write sites/<site>.ts exporting a
// `Site` and list it here; its URL-only part, if it needs one (a title
// from the URL, a wrapper to unwrap, titles that name nothing), goes in
// shared/sites/ under the same name, because the browser needs it too.

import { googleMaps } from './googleMaps'
import { googleShare } from './googleShare'
import { hackerNews } from './hackerNews'
import { instagram } from './instagram'
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
  googleShare,
  instagram,
]

export type SiteMatch = SitePage & { site: Site['name'] }

// The site rule for a link, or null when no rule claims it.
export const matchSite = (url: URL): SiteMatch | null => {
  for (const site of SITES) {
    const page = site.match(url)
    if (page) {
      return { ...page, site: site.name }
    }
  }

  return null
}
