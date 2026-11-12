'use node'

// Reads a link. Its site rule (sites/), when one matches, is consulted
// first: a share link is followed to what it shares (rewrite), the site's
// own endpoint is called (resolve), what the page gave is fixed
// (cleanPage, cleanTitle, isGenericDescription) and gaps are filled from
// the URL and its redirects (fromUrl). A link no rule matches is the base
// workflow: the generic page fetch alone. Never worse than the base: a
// rule's hook that fails, times out or says nothing leaves the page's
// result exactly as it was.
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from '../../../shared/limits'
import { parseHttpUrl } from '../../../shared/url'
import { capText } from '../text'
import {
  FETCH_TIMEOUT_MS,
  fetchJson,
  fetchPage,
  locateRedirect,
  type FetchFailure,
} from './fetch'
import type { PageMetadata } from './parse'
import { matchSite, type SiteMatch } from './sites'
import type { SiteMetadata } from './sites/types'
import { cleanImageUrl } from './url'

// Body text kept for the summary prompt, as parse.ts keeps for pages.
const MAX_TEXT_LENGTH = 2000

export type LinkRead = {
  // The site's own domain when its rule answered, else the final page's
  // host.
  domain: string
  metadata: PageMetadata
}

// A rule's answer with every field capped and the image checked, or null
// when nothing useful is left. Its values came from a third party.
const cleanSiteMetadata = (
  raw: SiteMetadata | null | undefined,
): SiteMetadata | null => {
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

const warn = (site: SiteMatch, hook: string, error: unknown): void => {
  console.warn('[readLink] Site rule failed', {
    site: site.site,
    hook,
    error: error instanceof Error ? error.message : String(error),
  })
}

// Runs one of a rule's network hooks; null when it throws, so a rule
// never breaks the read.
const guarded = async <T>(
  site: SiteMatch,
  hook: string,
  run: () => Promise<T | null> | undefined,
): Promise<T | null> => {
  try {
    return (await run()) ?? null
  } catch (error) {
    warn(site, hook, error)
    return null
  }
}

// Runs one of a rule's pure hooks; `fallback` (what the base gave) when
// it throws.
const safely = <T>(
  site: SiteMatch,
  hook: string,
  run: () => T,
  fallback: T,
): T => {
  try {
    return run()
  } catch (error) {
    warn(site, hook, error)
    return fallback
  }
}

// The page's metadata with the rule's fixes applied, or null when the
// rule says the page is not the content.
const cleanedPage = (
  site: SiteMatch | null,
  metadata: PageMetadata,
): PageMetadata | null => {
  const { cleanPage, cleanTitle, isGenericDescription } = site ?? {}
  if (!site) {
    return metadata
  }

  const cleaned = cleanPage
    ? safely(site, 'cleanPage', () => cleanPage(metadata), metadata)
    : metadata
  if (!cleaned) {
    return null
  }
  const { title, description } = cleaned

  return {
    ...cleaned,
    title:
      title && cleanTitle
        ? safely(site, 'cleanTitle', () => cleanTitle(title), title)
        : title,
    description:
      description &&
      isGenericDescription &&
      safely(
        site,
        'isGenericDescription',
        () => isGenericDescription(description),
        false,
      )
        ? undefined
        : description,
  }
}

const hasContent = (metadata: PageMetadata): boolean =>
  !!(metadata.title || metadata.description || metadata.image)

// `url` must already be normalised (parseHttpUrl). Everything made for the
// link (a rewrite's redirects, the page, the site's endpoint) shares one
// FETCH_TIMEOUT_MS deadline; the page and the endpoint are fetched at
// once, so a rule never makes a link take longer than that. Where both
// answer, the endpoint's title wins and each other field comes from
// whichever has it (the endpoint first), then fromUrl fills what is still
// missing. Counts as read when any of them gave something. Never throws.
export const readLink = async (
  link: URL,
): Promise<{ link: LinkRead } | { error: FetchFailure }> => {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  let url = link
  let site = matchSite(url)

  // 1. rewrite: read what a share link shares, under that URL's own rule.
  // Once only; a failure reads the link itself.
  if (site?.rewrite) {
    const { rewrite } = site
    const target = await guarded(site, 'rewrite', () =>
      rewrite((until) => locateRedirect(link, until, signal)),
    )
    const parsed = target ? parseHttpUrl(target.href) : null
    if (parsed) {
      url = parsed
      site = matchSite(parsed)
    }
  }

  // 2. resolve, alongside the page fetch.
  const resolve = site?.resolve
  const resolving =
    site && resolve
      ? guarded(site, 'resolve', () =>
          resolve((endpoint) => fetchJson(endpoint, signal)),
        ).then(cleanSiteMetadata)
      : Promise.resolve(null)

  const [fetched, resolved] = await Promise.all([
    fetchPage(url.href, signal),
    resolving,
  ])

  // 3. cleanPage.
  const page = 'page' in fetched ? fetched.page : undefined
  const pageMetadata = page ? cleanedPage(site, page.metadata) : null

  const merged: PageMetadata = {
    title: resolved?.title ?? pageMetadata?.title,
    description: resolved?.description ?? pageMetadata?.description,
    image: resolved?.image ?? pageMetadata?.image,
    text: resolved?.text ?? pageMetadata?.text,
  }

  // 4. from the URL and its redirects, only for what is still missing.
  const derive = site?.fromUrl
  const fromUrl =
    site && derive
      ? cleanSiteMetadata(
          safely(
            site,
            'fromUrl',
            () => derive(fetched.redirects, merged),
            null,
          ),
        )
      : null
  const metadata: PageMetadata = {
    title: merged.title ?? fromUrl?.title,
    description: merged.description ?? fromUrl?.description,
    image: merged.image,
    text: merged.text,
  }

  if (site && (resolved || page || fromUrl)) {
    console.log('[readLink] Site', {
      site: site.site,
      rewritten: url !== link,
      resolved: !!resolved,
      page: !!pageMetadata,
      fromUrl: !!fromUrl,
    })
  }

  // The site's own domain unless only the page answered; a page its rule
  // rejected (a login wall) with nothing else read is unread.
  const domain =
    site && (resolved || !pageMetadata) ? site.domain : page?.domain
  if (!domain || (!pageMetadata && !hasContent(metadata))) {
    return { error: 'error' in fetched ? fetched.error : 'INTERSTITIAL' }
  }

  return { link: { domain, metadata } }
}
