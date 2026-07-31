import Docxtemplater from 'docxtemplater'
import expressions from 'docxtemplater/expressions.js'
import PizZip from 'pizzip'

import type { ResumeData } from '../../../shared/resumeSchema'

const CONTACT_SEPARATOR = '    '

export type CoverLetterTemplateData = {
  senderName: string
  contactLine: string
  date: string
  company: string
  greeting: string
  paragraphs: Array<string>
}

// Fallback display when a link has no label — compact form of the URL.
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

type ContactSegment = {
  text: string
  href?: string
}

function withScheme(url: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`
}

// The contact line renders link labels only (like the original resume);
// linkifyContactLine turns them into real hyperlinks after rendering.
export function buildContactSegments(
  header: ResumeData['header'],
): Array<ContactSegment> {
  const segments: Array<ContactSegment> = []

  const push = (segment: ContactSegment) => {
    if (!segment.text) {
      return
    }
    if (segments.length > 0) {
      segments.push({ text: CONTACT_SEPARATOR })
    }
    segments.push(segment)
  }

  push({ text: header.phone.trim() })

  const email = header.email.trim()
  push({ text: email, href: email ? `mailto:${email}` : undefined })

  for (const link of header.links) {
    const url = link.url.trim()
    const label = link.label.trim() || displayUrl(url)
    push({ text: label, href: url ? withScheme(url) : undefined })
  }

  push({ text: header.location.trim() })

  return segments
}

export function buildContactLine(header: ResumeData['header']): string {
  return buildContactSegments(header)
    .map((segment) => segment.text)
    .join('')
}

export function renderResumeTemplate(
  templateBuffer: ArrayBuffer | Uint8Array,
  data: ResumeData,
): Uint8Array {
  const rendered = renderTemplate(templateBuffer, {
    ...data,
    header: { ...data.header, contactLine: buildContactLine(data.header) },
  })
  return linkifyContactLine(rendered, data.header)
}

export function renderCoverLetterTemplate(
  templateBuffer: ArrayBuffer | Uint8Array,
  data: CoverLetterTemplateData,
  header?: ResumeData['header'],
): Uint8Array {
  const rendered = renderTemplate(templateBuffer, data)
  return header ? linkifyContactLine(rendered, header) : rendered
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttr(text: string): string {
  return escapeXmlText(text).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// Rewrites the rendered contact-line run into a sequence of runs where the
// email and each link label are real hyperlinks. Purely additive: if the
// contact line cannot be located, the document is returned unchanged.
export function linkifyContactLine(
  docxBytes: Uint8Array,
  header: ResumeData['header'],
): Uint8Array {
  const segments = buildContactSegments(header)
  if (!segments.some((segment) => segment.href)) {
    return docxBytes
  }

  const zip = new PizZip(docxBytes)
  const docFile = zip.file('word/document.xml')
  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (!docFile || !relsFile) {
    return docxBytes
  }

  let documentXml = docFile.asText()
  let relsXml = relsFile.asText()

  // The hyperlink r:id attributes need the relationships namespace, which
  // neither template declares on its root element.
  if (!documentXml.includes('xmlns:r=')) {
    documentXml = documentXml.replace(
      /<w:document\b/,
      '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    )
  }

  const line = segments.map((segment) => segment.text).join('')
  const tIndex = documentXml.indexOf(`>${escapeXmlText(line)}</w:t>`)
  if (tIndex === -1) {
    return docxBytes
  }

  const runStart = Math.max(
    documentXml.lastIndexOf('<w:r>', tIndex),
    documentXml.lastIndexOf('<w:r ', tIndex),
  )
  const runEnd = documentXml.indexOf('</w:r>', tIndex)
  if (runStart === -1 || runEnd === -1) {
    return docxBytes
  }

  const runXml = documentXml.slice(runStart, runEnd + '</w:r>'.length)
  const rPr = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ''

  let linkCounter = 0
  const relEntries: Array<string> = []

  const replacement = segments
    .map((segment) => {
      const textElement = `<w:t xml:space="preserve">${escapeXmlText(segment.text)}</w:t>`
      if (!segment.href) {
        return `<w:r>${rPr}${textElement}</w:r>`
      }

      let id = `rCvLink${++linkCounter}`
      while (relsXml.includes(`Id="${id}"`)) {
        id = `rCvLink${++linkCounter}`
      }
      relEntries.push(
        `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXmlAttr(segment.href)}" TargetMode="External"/>`,
      )
      return `<w:hyperlink r:id="${id}" w:history="1"><w:r>${rPr}${textElement}</w:r></w:hyperlink>`
    })
    .join('')

  documentXml =
    documentXml.slice(0, runStart) +
    replacement +
    documentXml.slice(runEnd + '</w:r>'.length)
  relsXml = relsXml.replace(
    '</Relationships>',
    `${relEntries.join('')}</Relationships>`,
  )

  zip.file('word/document.xml', documentXml)
  zip.file('word/_rels/document.xml.rels', relsXml)

  return zip.generate({ type: 'uint8array' })
}

function renderTemplate(
  templateBuffer: ArrayBuffer | Uint8Array,
  data: Record<string, unknown>,
): Uint8Array {
  const buffer =
    templateBuffer instanceof Uint8Array
      ? templateBuffer
      : new Uint8Array(templateBuffer)
  const zip = new PizZip(buffer)

  // oxlint-disable-next-line typescript/no-explicit-any -- accessing docxtemplater's undocumented internal FileTypeConfig static
  const fileTypeConfig = (Docxtemplater as any).FileTypeConfig.docx()
  fileTypeConfig.getTemplatedFiles = () => ['word/document.xml']

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: expressions,
    fileTypeConfig,
  })

  doc.render(data)

  return doc.getZip().generate({ type: 'uint8array' })
}
