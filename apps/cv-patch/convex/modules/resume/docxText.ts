// Pure .docx text extraction: turns word/document.xml (plus its
// relationships) into plain text for the extraction LLM. One line per
// paragraph; numbered/bulleted paragraphs are prefixed with "• ".

export function parseHyperlinkTargets(relsXml: string): Map<string, string> {
  const targets = new Map<string, string>()
  const relRegex = /<Relationship\b[^>]*\/?>/g
  let match: RegExpExecArray | null

  while ((match = relRegex.exec(relsXml)) !== null) {
    const element = match[0]
    if (!element.includes('/hyperlink')) {
      continue
    }
    const id = element.match(/\bId="([^"]+)"/)?.[1]
    const target = element.match(/\bTarget="([^"]+)"/)?.[1]
    if (id && target) {
      targets.set(id, decodeXml(target))
    }
  }

  return targets
}

// Appends each hyperlink's target after its visible text so the LLM can see
// real URLs, e.g. "LinkedIn (https://linkedin.com/in/foo)".
export function inlineHyperlinkTargets(
  xml: string,
  targets: Map<string, string>,
): string {
  return xml.replace(
    /<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink>/g,
    (whole, attrs: string, inner: string) => {
      const rid = attrs.match(/r:id="([^"]+)"/)?.[1]
      const target = rid ? targets.get(rid) : undefined
      if (!target) {
        return whole
      }
      const escaped = target
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return `${inner}<w:t xml:space="preserve"> (${escaped})</w:t>`
    },
  )
}

export function extractPlainText(
  xml: string,
  hyperlinkTargets: Map<string, string> = new Map(),
): string {
  const withTargets = inlineHyperlinkTargets(xml, hyperlinkTargets)
  const paragraphs: Array<string> = []
  const paragraphRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
  let match: RegExpExecArray | null

  while ((match = paragraphRegex.exec(withTargets)) !== null) {
    const paragraphXml = match[0]
    const isBullet = /<w:numPr\b/.test(paragraphXml)
    const text = extractTextFromParagraph(paragraphXml)
    const cleaned = normalizeWhitespace(text)
    if (!cleaned) {
      continue
    }
    paragraphs.push(isBullet ? `• ${cleaned}` : cleaned)
  }

  return paragraphs.join('\n')
}

export function extractTextFromParagraph(paragraphXml: string): string {
  const normalized = paragraphXml
    .replace(/<w:tab[^>]*\/>/g, '<w:t>\t</w:t>')
    .replace(/<w:br[^>]*\/>/g, '<w:t>\n</w:t>')
  const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g
  const parts: Array<string> = []
  let match: RegExpExecArray | null

  while ((match = textRegex.exec(normalized)) !== null) {
    parts.push(decodeXml(match[1]))
  }

  return parts.join('')
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  amp: '&',
}

// One pass, so a decoded "&" never starts a new entity: "&#38;lt;" is
// "&lt;", not "<".
export function decodeXml(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-fA-F]+)|#([0-9]+)|(quot|apos|lt|gt|amp));/g,
    (whole, hex?: string, num?: string, named?: string) => {
      if (named) {
        return NAMED_ENTITIES[named]
      }
      const codePoint = hex ? parseInt(hex, 16) : parseInt(num ?? '', 10)
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : whole
    },
  )
}

// A tab separates the left text from the right-aligned column (e.g.
// "Acme Ltd<tab>London | 2021 - Present"), so it is kept as one tab for the
// LLM to see the column boundary; other whitespace collapses to a space.
function normalizeWhitespace(text: string): string {
  return text
    .split(/\s*\t\s*/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\t')
}
