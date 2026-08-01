// OpenAI's web-search tool embeds citation markers in output text: ASCII tokens
// like "citeturn0search13" wrapped in private-use-area unicode delimiters
// (U+E200-U+E203). They are metadata, not prose — strip them everywhere text is
// shown to the user or rendered into a document.
// Delimiters are built via fromCharCode so this file stays pure ASCII.

const BLOCK_START = String.fromCharCode(0xe200)
const BLOCK_END = String.fromCharCode(0xe201)

const DELIMITED_BLOCK = new RegExp(
  `${BLOCK_START}[^${BLOCK_START}]*?(?:${BLOCK_END}|$)`,
  'g',
)
const PUA_CHARS = new RegExp('[\\ue000-\\uf8ff]', 'g')
const BARE_TOKENS = /\bcite(?:turn\d+[a-z]+\d+)+\b|\bturn\d+[a-z]+\d+\b/g

export function stripCitationMarkers(text: string): string {
  return text
    .replace(DELIMITED_BLOCK, (block) =>
      // Only delete delimited spans that are actually citation payloads;
      // otherwise just drop the delimiter characters.
      /cite|turn\d|navlist/.test(block) ? '' : block.replace(PUA_CHARS, ''),
    )
    .replace(PUA_CHARS, '')
    .replace(BARE_TOKENS, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .trim()
}

// Recursively strips citation markers from every string in a JSON-shaped value.
export function deepStripCitations<T>(value: T): T {
  if (typeof value === 'string') {
    return stripCitationMarkers(value) as T
  }
  if (Array.isArray(value)) {
    return value.map(deepStripCitations) as T
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        deepStripCitations(entry),
      ]),
    ) as T
  }
  return value
}
