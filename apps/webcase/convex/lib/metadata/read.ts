'use node'

// Reads a link: the generic page fetch, plus the site's own endpoint when a
// site resolver (sites/) claims the URL. Never worse than the page alone:
// a resolver that doesn't match, fails, times out or says nothing leaves
// the page's result exactly as it was.
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from '../../../shared/limits'
import { capText } from '../text'
import {
  FETCH_TIMEOUT_MS,
  fetchJson,
  fetchPage,
  type FetchFailure,
} from './fetch'
import type { PageMetadata } from './parse'
import { matchSite } from './sites'
import type { SiteMetadata } from './sites/types'
import { cleanImageUrl } from './url'

// Body text kept for the summary prompt, as parse.ts keeps for pages.
const MAX_TEXT_LENGTH = 2000

export type LinkRead = {
  // The site's own domain when its resolver answered, else the final
  // page's host.
  domain: string
  metadata: PageMetadata
}

// A resolver's answer with every field capped and the image checked, or
// null when nothing useful is left. Its values came from a third party.
const cleanSiteMetadata = (raw: SiteMetadata | null): SiteMetadata | null => {
  if (!raw) {
    return null
  }

  const metadata = {
    title: capText(raw.title, MAX_TITLE_LENGTH),
    description: capText(raw.description, MAX_DESCRIPTION_LENGTH),
    image: cleanImageUrl(raw.image),
    text: capText(raw.text, MAX_TEXT_LENGTH),
  }

  return metadata.title || metadata.description || metadata.image
    ? metadata
    : null
}

// `url` must already be normalised (parseHttpUrl). The page and the site's
// endpoint are fetched at once and share one FETCH_TIMEOUT_MS deadline, so
// a resolver never makes a link take longer than the page alone could.
// Where both answer, the resolver's title wins and each other field comes
// from whichever has it (the resolver first). Counts as read when either
// did. Never throws.
export const readLink = async (
  url: URL,
): Promise<{ link: LinkRead } | { error: FetchFailure }> => {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const site = matchSite(url)

  const resolving = site?.resolve
    ? site
        .resolve((endpoint) => fetchJson(endpoint, signal))
        .then(cleanSiteMetadata)
        .catch((error: unknown) => {
          console.warn('[readLink] Resolver failed', {
            site: site.site,
            error: error instanceof Error ? error.message : String(error),
          })
          return null
        })
    : Promise.resolve(null)

  const [fetched, resolved] = await Promise.all([
    fetchPage(url.href, signal),
    resolving,
  ])

  const page = 'page' in fetched ? fetched.page : undefined
  const pageMetadata =
    page && site?.cleanPage ? site.cleanPage(page.metadata) : page?.metadata

  if (site && (resolved || page)) {
    console.log('[readLink] Site', {
      site: site.site,
      resolved: !!resolved,
      page: !!page,
    })
  }

  if (!resolved || !site) {
    return page && pageMetadata
      ? { link: { domain: page.domain, metadata: pageMetadata } }
      : { error: 'error' in fetched ? fetched.error : 'NETWORK' }
  }

  return {
    link: {
      domain: site.domain,
      metadata: {
        title: resolved.title ?? pageMetadata?.title,
        description: resolved.description ?? pageMetadata?.description,
        image: resolved.image ?? pageMetadata?.image,
        text: resolved.text ?? pageMetadata?.text,
      },
    },
  }
}
