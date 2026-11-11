// Tags are lowercase words; every screen colours a tag the same way from its name.

const MAX_TAG_LENGTH = 40

/** Trims, drops leading #s, lowercases and collapses spaces. Returns '' for nothing usable. */
export const normalizeTag = (raw: string) =>
  raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_TAG_LENGTH)
    .trim()

// Static class names so Tailwind sees them; they map to --tag-1 … --tag-8 in index.css.
const TAG_DOT_CLASSES = [
  'bg-tag-1',
  'bg-tag-2',
  'bg-tag-3',
  'bg-tag-4',
  'bg-tag-5',
  'bg-tag-6',
  'bg-tag-7',
  'bg-tag-8',
] as const

/** A stable 0–7 palette slot for a tag: FNV-1a over the normalised name, then mixed. */
export const tagColorIndex = (name: string) => {
  let hash = 0x811c9dc5
  for (const char of normalizeTag(name)) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  // FNV's low bits are weak on short words; mix them before taking the slot.
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  return (hash >>> 0) % TAG_DOT_CLASSES.length
}

/** The background class (`bg-tag-N`) for a tag's dot. */
export const tagDotClass = (name: string) =>
  TAG_DOT_CLASSES[tagColorIndex(name)]
