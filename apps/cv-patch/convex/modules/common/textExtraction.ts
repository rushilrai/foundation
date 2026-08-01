export type SourceKind = 'docx' | 'pdf' | 'text'

export function getSourceKind(fileName: string): SourceKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf') return 'pdf'
  if (ext === 'tex' || ext === 'txt') return 'text'
  return null
}

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

// Surfaces targets to the LLM as "LinkedIn (https://linkedin.com/in/foo)".
function inlineHyperlinkTargets(
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

function extractTextFromParagraph(paragraphXml: string): string {
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

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, num) =>
      String.fromCodePoint(parseInt(num, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
