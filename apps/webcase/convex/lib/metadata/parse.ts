// Pure HTML metadata parsing: title, description and image from <title>,
// Open Graph, Twitter and <meta name="description"> tags, plus a short
// plain-text extract of the body for summaries. No I/O here.

export const MAX_TITLE_LENGTH = 300
export const MAX_DESCRIPTION_LENGTH = 500
export const MAX_IMAGE_URL_LENGTH = 2048
export const MAX_TEXT_LENGTH = 2000

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

export const decodeEntities = (value: string): string =>
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

// Collapses whitespace, decodes entities and caps the length.
const clean = (value: string | undefined, max: number): string | undefined => {
  if (!value) {
    return undefined
  }

  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  if (!text) {
    return undefined
  }

  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

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

// The <head> is where metadata lives; some sites omit </head>, so fall back
// to the first chunk of the document.
const headOf = (html: string): string => {
  const end = html.search(/<\/head\s*>|<body[\s>]/i)

  return end === -1 ? html.slice(0, 200_000) : html.slice(0, end)
}

// meta property/name → content, first occurrence wins.
const readMetaTags = (head: string): Map<string, string> => {
  const meta = new Map<string, string>()

  for (const match of head.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0])
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

  return meta
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

const resolveImage = (
  raw: string | undefined,
  pageUrl: URL,
): string | undefined => {
  if (!raw) {
    return undefined
  }

  try {
    const url = new URL(decodeEntities(raw.trim()), pageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }
    return url.href.length > MAX_IMAGE_URL_LENGTH ? undefined : url.href
  } catch {
    return undefined
  }
}

// Visible text of the page, roughly: drops head, scripts, styles and tags.
export const extractText = (html: string): string | undefined => {
  const bodyStart = html.search(/<body[\s>]/i)
  const body = bodyStart === -1 ? html : html.slice(bodyStart)

  const text = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<(script|style|noscript|svg|template|iframe|nav|footer|header|form|select)\b[\s\S]*?<\/\1\s*>/gi,
      ' ',
    )
    .replace(/<[^>]+>/g, ' ')

  return clean(text, MAX_TEXT_LENGTH)
}

export const parseMetadata = (html: string, pageUrl: URL): PageMetadata => {
  const head = headOf(html)
  const meta = readMetaTags(head)
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1]

  return {
    title: clean(
      firstOf(meta, ['og:title', 'twitter:title']) ?? titleTag,
      MAX_TITLE_LENGTH,
    ),
    description: withoutBoilerplate(
      clean(
        firstOf(meta, ['og:description', 'twitter:description', 'description']),
        MAX_DESCRIPTION_LENGTH,
      ),
    ),
    image: resolveImage(
      firstOf(meta, [
        'og:image:secure_url',
        'og:image',
        'og:image:url',
        'twitter:image',
        'twitter:image:src',
      ]),
      pageUrl,
    ),
    text: extractText(html),
  }
}
