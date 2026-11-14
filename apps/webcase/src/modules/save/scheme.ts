import type { SharedPayload } from './schema'
import { findSharedUrl, toHttpUrl } from './utils'

// The installed app's own link scheme (`protocol_handlers` in
// public/manifest.json): another app opens a `web+webcase:` link and the
// operating system launches the app at /open?link=<that link>. Two forms:
//   web+webcase:https://example.com/page?x=1#y   the link itself, as is or
//                                                URL-encoded once
//   web+webcase://save?url=…&title=…&text=…       /save's params, encoded
// Any other page can open such a link too, so the payload is untrusted:
// what comes out is only ever a /save payload whose `url` passed the same
// checks as a shared link, never a place to navigate to.

// The scheme, then the rest. The browser lowercases a scheme, but a link
// typed by hand may not be; a `+` read as form data arrives as a space.
const SCHEME = /^\s*web[+ ]webcase:/i

// The first `:`, `/`, `?` or `#` is percent-encoded: the link was encoded
// once by whoever built the `web+webcase:` URL ("https%3A%2F%2F…"). A link
// written out keeps its own escapes ("https://x.com/a%2Fb").
const ENCODED_LINK = /^[^:/?#]*%(?:3a|2f|3f|23)/i

// The link after `web+webcase:`, decoded when it was encoded. The whole of
// it must be the link: another scheme (`javascript:`, `data:`, a nested
// `web+webcase:`) is no link.
const directLink = (rest: string): string | null => {
  let value = rest
  if (ENCODED_LINK.test(value)) {
    try {
      value = decodeURIComponent(value)
    } catch {
      return null
    }
  }
  return toHttpUrl(value)
}

// `//save?…`: read exactly as /save reads its search params. Everything
// after the `?` is the query, so a `#` in an unencoded value stays in it.
const saveLink = (rest: string): SharedPayload | null => {
  const query = rest.indexOf('?')
  const target = rest.slice(2, query === -1 ? undefined : query)
  if (target.replace(/\/+$/, '').toLowerCase() !== 'save' || query === -1) {
    return null
  }

  const params = new URLSearchParams(rest.slice(query + 1))
  const payload: SharedPayload = {
    url: params.get('url') ?? undefined,
    title: params.get('title') ?? undefined,
    text: params.get('text') ?? undefined,
  }
  const url = findSharedUrl(payload)

  return url ? { ...payload, url } : null
}

// What a `web+webcase:` link asks to save: /save's payload, with `url` the
// normalised link, or null when it carries no link (the library opens).
export const parseSchemeLink = (
  link: string | undefined,
): SharedPayload | null => {
  const scheme = link ? SCHEME.exec(link) : null
  if (!link || !scheme) return null

  const rest = link.slice(scheme[0].length)
  if (rest.startsWith('//')) return saveLink(rest)

  const url = directLink(rest)
  return url ? { url } : null
}
