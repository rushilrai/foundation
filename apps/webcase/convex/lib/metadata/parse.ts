// Pure HTML metadata parsing: title, description and image from <title>,
// Open Graph, Twitter and <meta name="description"> tags, plus a short
// plain-text extract of the body for summaries. No I/O here.
//
// Pages are hostile input of up to 512 KB, so everything here is linear:
// tags are found with indexOf from a moving cursor, never with a regex that
// can rescan the rest of the document from each candidate position.

import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from '../../../shared/limits'
import { capText } from '../text'
import { cleanImageUrl } from './url'

// Body text kept for the summary prompt.
const MAX_TEXT_LENGTH = 2000
// How much of the document is searched for metadata and for body text.
// Real <head>s are far smaller; this bounds the work on hostile pages.
const MAX_HEAD_SCAN = 200_000
const MAX_BODY_SCAN = 100_000
// Longer tags are skipped rather than parsed for attributes.
const MAX_TAG_LENGTH = 16_384

export type PageMetadata = {
  title?: string
  description?: string
  image?: string
  // Plain text from the body, for the summary prompt only.
  text?: string
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  laquo: '«',
  raquo: '»',
  middot: '·',
  bull: '•',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  times: '×',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  rarr: '→',
  larr: '←',
  star: '☆',
  starf: '★',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  szlig: 'ß',
  ntilde: 'ñ',
  ccedil: 'ç',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
}

const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body) => {
    const entity = String(body)
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10)
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
        return match
      }
      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })

// Decodes entities, then collapses whitespace and caps the length.
const clean = (value: string | undefined, max: number): string | undefined =>
  value ? capText(decodeEntities(value), max) : undefined

// Attributes of one tag, keys lowercased. Handles any attribute order and
// double, single or unquoted values.
const parseAttributes = (tag: string): Record<string, string> => {
  const attributes: Record<string, string> = {}
  const pattern =
    /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

  // Skip the tag name itself.
  const body = tag.replace(/^<\s*[a-z]+/i, '').replace(/\/?>$/, '')
  for (const match of body.matchAll(pattern)) {
    const name = match[1].toLowerCase()
    if (!(name in attributes)) {
      attributes[name] = match[2] ?? match[3] ?? match[4] ?? ''
    }
  }

  return attributes
}

// The character after a tag name: whitespace, `>` or `/` end the name, so
// `<meta` matches `<meta name>` but not `<metadata>`.
const endsTagName = (char: string | undefined): boolean =>
  char === undefined || char === '>' || char === '/' || /\s/.test(char)

// Index of the next `<name` tag at or after `from` in `lower` (the document
// lowercased), or -1.
const findTag = (lower: string, name: string, from: number): number => {
  let index = lower.indexOf(`<${name}`, from)
  while (index !== -1 && !endsTagName(lower[index + name.length + 1])) {
    index = lower.indexOf(`<${name}`, index + 1)
  }
  return index
}

// The <head> is where metadata lives; some sites omit </head>, so fall back
// to the first chunk of the document.
const headOf = (html: string, lower: string): string => {
  const headEnd = lower.indexOf('</head')
  const bodyStart = findTag(lower, 'body', 0)
  const ends = [headEnd, bodyStart].filter((index) => index !== -1)
  const end = ends.length > 0 ? Math.min(...ends) : MAX_HEAD_SCAN

  return html.slice(0, Math.min(end, MAX_HEAD_SCAN))
}

// meta property/name → content, first occurrence wins.
const readMetaTags = (head: string): Map<string, string> => {
  const meta = new Map<string, string>()
  const lower = head.toLowerCase()

  let cursor = findTag(lower, 'meta', 0)
  while (cursor !== -1) {
    const end = head.indexOf('>', cursor)
    if (end === -1) {
      break
    }
    if (end - cursor <= MAX_TAG_LENGTH) {
      const attributes = parseAttributes(head.slice(cursor, end + 1))
      const key = (
        attributes.property ??
        attributes.name ??
        attributes.itemprop ??
        ''
      ).toLowerCase()
      const content = attributes.content
      if (key && content !== undefined && !meta.has(key)) {
        meta.set(key, content)
      }
    }
    cursor = findTag(lower, 'meta', end + 1)
  }

  return meta
}

const readTitleTag = (head: string): string | undefined => {
  const lower = head.toLowerCase()
  const start = findTag(lower, 'title', 0)
  if (start === -1) {
    return undefined
  }
  const open = head.indexOf('>', start)
  if (open === -1) {
    return undefined
  }
  const close = lower.indexOf('</title', open + 1)

  return close === -1 ? undefined : head.slice(open + 1, close)
}

// Site-wide descriptions that say nothing about the page. Google Maps
// serves this one for places that have no address in og:description.
const BOILERPLATE_DESCRIPTIONS = new Set([
  'find local businesses, view maps and get driving directions in google maps.',
])

const withoutBoilerplate = (
  description: string | undefined,
): string | undefined =>
  description && BOILERPLATE_DESCRIPTIONS.has(description.toLowerCase())
    ? undefined
    : description

const firstOf = (
  meta: Map<string, string>,
  keys: Array<string>,
): string | undefined => {
  for (const key of keys) {
    const value = meta.get(key)?.trim()
    if (value) {
      return value
    }
  }

  return undefined
}

// Elements whose content is not page text; skipped whole.
const SKIPPED_ELEMENTS = new Set([
  'script',
  'style',
  'noscript',
  'svg',
  'template',
  'iframe',
  'nav',
  'footer',
  'header',
  'form',
  'select',
])

// Visible text of the page, roughly: drops head, comments, scripts, styles
// and tags. One forward pass over at most MAX_BODY_SCAN characters of the
// body, stopping once enough text is collected. An unclosed comment or
// skipped element swallows the rest, as it would in a browser.
const extractText = (html: string): string | undefined => {
  const bodyStart = findTag(html.toLowerCase(), 'body', 0)
  const body = html.slice(
    bodyStart === -1 ? 0 : bodyStart,
    (bodyStart === -1 ? 0 : bodyStart) + MAX_BODY_SCAN,
  )
  const lower = body.toLowerCase()

  const parts: Array<string> = []
  let collected = 0
  let cursor = 0

  while (cursor < body.length && collected < MAX_TEXT_LENGTH * 2) {
    const open = body.indexOf('<', cursor)
    const textEnd = open === -1 ? body.length : open
    if (textEnd > cursor) {
      const text = body.slice(cursor, textEnd)
      parts.push(text)
      collected += text.length
    }
    if (open === -1) {
      break
    }

    if (body.startsWith('<!--', open)) {
      const close = body.indexOf('-->', open + 4)
      if (close === -1) {
        break
      }
      cursor = close + 3
      continue
    }

    const tagEnd = body.indexOf('>', open)
    if (tagEnd === -1) {
      break
    }
    const name = /^<([a-z][a-z0-9-]*)/.exec(lower.slice(open, open + 32))?.[1]
    cursor = tagEnd + 1
    if (name && SKIPPED_ELEMENTS.has(name) && body[tagEnd - 1] !== '/') {
      const close = findTag(lower, `/${name}`, cursor)
      if (close === -1) {
        break
      }
      const closeEnd = body.indexOf('>', close)
      cursor = closeEnd === -1 ? body.length : closeEnd + 1
    }
    parts.push(' ')
  }

  return clean(parts.join(''), MAX_TEXT_LENGTH)
}

export const parseMetadata = (html: string, pageUrl: URL): PageMetadata => {
  const head = headOf(html, html.toLowerCase())
  const meta = readMetaTags(head)

  const image = firstOf(meta, [
    'og:image:secure_url',
    'og:image',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
  ])

  return {
    title: clean(
      firstOf(meta, ['og:title', 'twitter:title']) ?? readTitleTag(head),
      MAX_TITLE_LENGTH,
    ),
    description: withoutBoilerplate(
      clean(
        firstOf(meta, ['og:description', 'twitter:description', 'description']),
        MAX_DESCRIPTION_LENGTH,
      ),
    ),
    image: image ? cleanImageUrl(decodeEntities(image), pageUrl) : undefined,
    text: extractText(html),
  }
}
