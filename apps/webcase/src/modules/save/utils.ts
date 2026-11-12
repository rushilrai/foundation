import { domainOf, fallbackTitle, parseHttpUrl } from '@shared/url'

import type { SharedPayload } from './schema'

// An http(s) URL up to whitespace, angle brackets, quotes, backticks or the
// CJK punctuation that apps put right after a link.
const HTTP_URL = /https?:\/\/[^\s<>"'`，。、「」『』【】]+/i

// A host with at least one dot and a letters-only TLD, then an optional
// path, query or fragment: "example.com", "www.example.com/page?x=1".
const BARE_DOMAIN =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#]\S*)?$/i

const TRAILING_PUNCTUATION = /[.,;:!?…'"”’»*_~]$/
const CLOSERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

const count = (text: string, char: string) => text.split(char).length - 1

// Drops punctuation that ends the sentence around a link rather than the
// link itself: "…/page)." → "…/page", but "…/Foo_(bar)" keeps its bracket.
const trimTrailing = (raw: string): string => {
  let value = raw
  for (;;) {
    const last = value.at(-1)
    if (!last) return value
    const opener = CLOSERS[last]
    if (opener) {
      if (count(value, last) <= count(value, opener)) return value
    } else if (!TRAILING_PUNCTUATION.test(last)) {
      return value
    }
    value = value.slice(0, -1)
  }
}

// The normalised href for something a person typed or pasted: a full
// http(s) URL, or a bare domain, which is taken as https. Null otherwise.
const toHttpUrl = (raw: string): string | null => {
  const value = trimTrailing(raw.trim())
  if (!value) return null

  if (/^https?:\/\//i.test(value)) {
    return parseHttpUrl(value)?.href ?? null
  }
  // Any other scheme (mailto:, javascript:, ftp://) is not a link we save.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value)) return null

  return BARE_DOMAIN.test(value)
    ? (parseHttpUrl(`https://${value}`)?.href ?? null)
    : null
}

// The first link in a piece of text: an http(s) URL anywhere in it, else
// the whole text when it is a bare domain ("example.com/page") or a lone
// "www." token among other words.
export const findUrl = (text: string | undefined): string | null => {
  if (!text?.trim()) return null

  const match = HTTP_URL.exec(text)
  if (match) {
    const href = toHttpUrl(match[0])
    if (href) return href
  }

  const whole = toHttpUrl(text)
  if (whole) return whole

  const www = text.split(/\s+/).find((word) => /^www\./i.test(word))
  return www ? toHttpUrl(www) : null
}

// The link a share carried: `url` first, then the first link inside
// `text`, then inside `title`. Android apps often send it only in `text`.
export const findSharedUrl = ({
  url,
  title,
  text,
}: SharedPayload): string | null =>
  findUrl(url) ?? findUrl(text) ?? findUrl(title)

// What a link is saved with when its preview is missing: the readable
// fallback title (a Maps place name, a slug, else host and path), the same
// one the server falls back to.
export const fallbackLink = (href: string) => {
  const parsed = parseHttpUrl(href)
  if (!parsed) return null

  return {
    url: parsed.href,
    title: fallbackTitle(parsed),
    domain: domainOf(parsed),
  }
}
