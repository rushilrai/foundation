// The URL-only part of a site rule: what a link's URL alone says, with no
// network. Both the browser (the save sheet's fallback title, the import's
// normaliser) and Convex use it. A site's network part, when it has one,
// is in convex/lib/metadata/sites/ under the same name and uses this
// part's `match` instead of listing the site's hosts again.

export type UrlRule = {
  name: string
  // Recognises the site's URLs. Pure.
  match: (url: URL) => boolean
  // Hook 1, rewrite: the link is really another URL, written in its own
  // query (a redirect wrapper such as out.reddit.com). Returns the
  // destination as written, or null. The normaliser (parseHttpUrl) applies
  // it, so the destination is what is validated, stored, matched and read.
  rewrite?: (url: URL) => string | null
  // Hook 4, from the URL: the title the site puts in this URL, or null.
  // Used only when nothing better was read.
  title?: (url: URL) => string | null
  // Titles the site gives pages that name nothing ("Google Maps", a login
  // wall). They count as stand-ins (isPlaceholderTitle), so enrichment
  // replaces them.
  placeholderTitles?: ReadonlyArray<string>
}

// The hostname in lowercase without a trailing dot.
export const hostOf = (url: URL): string =>
  url.hostname.toLowerCase().replace(/\.$/, '')

export const decodePath = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export const pathSegments = (url: URL): Array<string> =>
  url.pathname.split('/').filter(Boolean)
