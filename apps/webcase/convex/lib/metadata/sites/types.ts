// The shape of a site resolver. Pure: a resolver gets its one network call
// (`getJson`) from read.ts, which runs it through the guarded fetch.

import type { PageMetadata } from '../parse'

// GETs a JSON endpoint through fetchJson (guarded, pinned, size-capped,
// under the link's deadline). The parsed body, unvalidated, or null for
// any failure.
export type GetJson = (endpoint: string) => Promise<unknown>

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
// already bound in.
export type SitePage = {
  // The site's own domain, shown for the link: never the endpoint's host.
  domain: string
  // Calls the site's endpoint. Null (or a throw) falls through to the page
  // fetch alone.
  resolve?: (getJson: GetJson) => Promise<SiteMetadata | null>
  // Fixes what the generic page fetch read, e.g. Reddit's title prefix.
  cleanPage?: (metadata: PageMetadata) => PageMetadata
}

export type Site = {
  name: string
  // Recognises the site's URLs (and extracts their ids) from the URL
  // alone, or null for any other link. Pure, no I/O.
  match: (url: URL) => SitePage | null
  // Fields resolve fills for a link it can read, so re-enrichment can tell
  // a link it already filled from one still missing them.
  provides: { description: boolean; image: boolean }
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
