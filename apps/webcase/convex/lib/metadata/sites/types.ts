// The network part of a site rule. A rule is consulted before anything is
// read; a link no rule matches is left to the base workflow (the page's
// own metadata). Pure: a rule gets its network calls (`getJson`,
// `locate`) from read.ts, which runs them through the guarded fetch under
// the link's one deadline. A rule's URL-only part, when it has one, is in
// shared/sites/ under the same name, and this part uses its `match`.

import type { PageMetadata } from '../parse'

// GETs a JSON endpoint through fetchJson (guarded, pinned, size-capped,
// under the link's deadline). The parsed body, unvalidated, or null for
// any failure.
export type GetJson = (endpoint: string) => Promise<unknown>

// Follows the link's redirects (guarded, under the link's deadline) until
// one points at a URL `until` accepts, and returns it unrequested; null
// when none does.
export type Locate = (until: (url: URL) => boolean) => Promise<URL | null>

// What a site's endpoint said about the link. Untrusted: read.ts caps
// every field and checks the image URL before anything uses it.
export type SiteMetadata = {
  title?: string
  description?: string
  image?: string
  // Text for the summary prompt only, e.g. an Ask HN post's body.
  text?: string
}

// One recognised link on a site, with what match() pulled out of its URL
// already bound in. Every hook is optional, and a hook that fails, times
// out or says nothing leaves the base result as it was.
export type SitePage = {
  // The site's own domain, shown for the link: never the endpoint's host.
  domain: string
  // Fields this rule fills for this link (resolve or fromUrl), so
  // re-enrichment can tell a link it filled from one still missing them.
  provides: { description: boolean; image: boolean }
  // 1. rewrite: the link is really another URL, found by following its
  // redirects (a Reddit share link is a post). The link is read as that
  // URL, under that URL's rule; the stored URL is not changed. Wrappers
  // that name their destination in the URL are rewritten earlier, by the
  // normaliser (shared/sites).
  rewrite?: (locate: Locate) => Promise<URL | null>
  // 2. resolve: calls the site's own endpoint, in parallel with the page.
  // Where both answer, its title wins and each other field comes from
  // whichever has it, the endpoint first.
  resolve?: (getJson: GetJson) => Promise<SiteMetadata | null>
  // 3. cleanPage: fixes what the page fetch read; null when the page is
  // not the content (a login wall), which then counts as unread.
  cleanPage?: (metadata: PageMetadata) => PageMetadata | null
  // 3, for a title alone: the site's decoration removed ("From the …
  // community on Reddit: ", " : Google Search"), undefined when nothing
  // that names the page is left. read.ts applies it to what was read, and
  // re-enrichment to stored titles, so a decorated title is replaceable.
  cleanTitle?: (title: string) => string | undefined
  // 3, for a description: true for one the site gives every page, which
  // says nothing; dropped when read, replaced when stored.
  isGenericDescription?: (description: string) => boolean
  // 4. from the URL: a title or description taken from the link's URL or
  // the redirects it went through (`redirects`, the link first), given
  // what was read. Fills only fields nothing else filled.
  fromUrl?: (redirects: Array<URL>, read: PageMetadata) => SiteMetadata | null
}

export type Site = {
  name: string
  // Recognises the site's URLs (and extracts their ids) from the URL
  // alone, or null for any other link. Pure, no I/O.
  match: (url: URL) => SitePage | null
}

// Untrusted JSON, read safely ------------------------------------------------

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

export const stringField = (
  record: Record<string, unknown> | null,
  key: string,
): string | undefined => {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value : undefined
}

export const numberField = (
  record: Record<string, unknown> | null,
  key: string,
): number | undefined => {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// The hostname in lowercase without a trailing dot.
export const hostOf = (url: URL): string =>
  url.hostname.toLowerCase().replace(/\.$/, '')
