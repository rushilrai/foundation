import type { Doc } from '@convex/_generated/dataModel'

// Browser-side search over the library. The server sends every link; this
// filters them as the user types.

// Lowercase, without accents: "Café" and "cafe" match each other.
export const foldText = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// Punctuation around a word ("bakery?", "“mumbai”") is not part of it.
const EDGE_PUNCTUATION = /^[?!.,;:"'“”‘’()[\]]+|[?!.,;:"'“”‘’()[\]]+$/g

/** The folded words of a query; a link must contain every one. */
export const searchWords = (query: string): string[] =>
  foldText(query)
    .split(/\s+/)
    .map((word) => word.replace(EDGE_PUNCTUATION, ''))
    .filter(Boolean)

/**
 * Whether a query reads like a question for `ask` rather than a filter:
 * three or more words, or a trailing question mark.
 */
export const isQuestion = (query: string) => {
  const text = query.trim()
  if (!text) return false
  return text.endsWith('?') || text.split(/\s+/).length >= 3
}

// Each link's searchable text, folded once. Keyed by the document object,
// so a live update (which delivers new objects) is folded again lazily.
const haystacks = new WeakMap<Doc<'links'>, string>()

const haystackOf = (link: Doc<'links'>) => {
  let haystack = haystacks.get(link)
  if (haystack === undefined) {
    haystack = foldText(
      [
        link.title,
        link.summary,
        link.description,
        link.domain,
        link.url,
        ...link.tags,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    haystacks.set(link, haystack)
  }
  return haystack
}

/** The links carrying `tag` (when set) whose text contains every word. */
export const filterLinks = (
  links: readonly Doc<'links'>[],
  words: readonly string[],
  tag: string | null,
): Doc<'links'>[] => {
  if (!tag && words.length === 0) return [...links]

  return links.filter((link) => {
    if (tag && !link.tags.includes(tag)) return false
    if (words.length === 0) return true
    const haystack = haystackOf(link)
    return words.every((word) => haystack.includes(word))
  })
}
