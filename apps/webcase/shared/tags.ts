// Tag rules, shared by the browser (TagPicker, import) and Convex (every
// mutation that stores tags), so both always agree on what a tag is.

export const MAX_TAG_LENGTH = 40
export const MAX_TAGS = 20

// Trims, drops leading #s, lowercases, collapses inner whitespace and caps
// the length. Returns '' when nothing usable is left.
export const normalizeTag = (raw: string): string =>
  raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TAG_LENGTH)
    .trim()

// Every tag normalised, empties dropped, de-duplicated in first-seen order,
// at most MAX_TAGS.
export const normalizeTags = (tags: ReadonlyArray<string>): Array<string> => {
  const seen = new Set<string>()

  for (const raw of tags) {
    if (seen.size === MAX_TAGS) {
      break
    }
    const tag = normalizeTag(raw)
    if (tag) {
      seen.add(tag)
    }
  }

  return [...seen]
}

// How many of the user's links carry a tag. The one tag-count shape, used
// by the tag filter and by the server's tag statistics.
export type TagCount = {
  tag: string
  count: number
}
