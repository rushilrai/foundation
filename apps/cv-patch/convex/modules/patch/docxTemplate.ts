import Docxtemplater from 'docxtemplater'
import expressions from 'docxtemplater/expressions.js'
import PizZip from 'pizzip'

import type { ResumeData } from '../../../shared/resumeSchema'

// Six spaces between contact items, as in the original resume.
const CONTACT_SEPARATOR = '      '

// Fallback display when a link has no label — compact form of the URL.
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
}

export type ContactSegment = {
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

// A trailing parenthetical in a company name renders italic and not bold,
// e.g. "Morgan Stanley (via Accolite)" -> bold "Morgan Stanley " + italic
// "(via Accolite)". Names without one render whole in companyName.
export function splitCompany(company: string): {
  companyName: string
  companySuffix: string
} {
  const match = company.match(/^(.*\S\s+)(\([^()]*\))\s*$/)
  return match
    ? { companyName: match[1], companySuffix: match[2] }
    : { companyName: company, companySuffix: '' }
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

  doc.render({
    ...data,
    header: { ...data.header, contactLine: buildContactLine(data.header) },
    experience: data.experience.map((entry) => ({
      ...entry,
      ...splitCompany(entry.company),
    })),
  })

  const rendered = doc.getZip().generate({ type: 'uint8array' })
  return linkifySkillLinks(
    linkifyProjectNames(linkifyContactLine(rendered, data.header), data),
    data.skills,
  )
}

function escapeXmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttr(text: string): string {
  return escapeXmlText(text).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// docxtemplater escapes quotes as well as &<>, so rendered text must be
// searched for in that form (e.g. an apostrophe in a project name).
function escapeRenderedText(text: string): string {
  return escapeXmlAttr(text)
}

const RELATIONSHIPS_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

// The template does not declare xmlns:r on its root element, which the
// hyperlink r:id attributes need. Idempotent across linkify passes.
function ensureRelationshipsNamespace(documentXml: string): string {
  return documentXml.includes('xmlns:r=')
    ? documentXml
    : documentXml.replace(
        /<w:document\b/,
        `<w:document xmlns:r="${RELATIONSHIPS_NS}"`,
      )
}

function hyperlinkRelationship(id: string, target: string): string {
  return `<Relationship Id="${id}" Type="${RELATIONSHIPS_NS}/hyperlink" Target="${escapeXmlAttr(target)}" TargetMode="External"/>`
}

// Next free relationship id with the given prefix; the counter is shared
// across calls in one pass so ids stay unique before they are written.
function nextRelId(
  relsXml: string,
  prefix: string,
  counter: { value: number },
): string {
  let id = `${prefix}${++counter.value}`
  while (relsXml.includes(`Id="${id}"`)) {
    id = `${prefix}${++counter.value}`
  }
  return id
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

  documentXml = ensureRelationshipsNamespace(documentXml)

  const line = segments.map((segment) => segment.text).join('')
  const tIndex = documentXml.indexOf(`>${escapeRenderedText(line)}</w:t>`)
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

  const counter = { value: 0 }
  const relEntries: Array<string> = []

  const replacement = segments
    .map((segment) => {
      const textElement = `<w:t xml:space="preserve">${escapeXmlText(segment.text)}</w:t>`
      if (!segment.href) {
        return `<w:r>${rPr}${textElement}</w:r>`
      }

      const id = nextRelId(relsXml, 'rCvLink', counter)
      relEntries.push(hyperlinkRelationship(id, segment.href))
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

// Wraps each linked project's name run in a real hyperlink post-render,
// keeping the run's original formatting. Projects without a url are skipped;
// runs that cannot be located are left as plain text.
export function linkifyProjectNames(
  docxBytes: Uint8Array,
  data: ResumeData,
): Uint8Array {
  if (!data.projects.some((project) => project.url.trim())) {
    return docxBytes
  }

  const zip = new PizZip(docxBytes)
  const docFile = zip.file('word/document.xml')
  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (!docFile || !relsFile) {
    return docxBytes
  }

  let documentXml = ensureRelationshipsNamespace(docFile.asText())
  let relsXml = relsFile.asText()

  const counter = { value: 0 }
  const relEntries: Array<string> = []
  // Projects render in order after the PROJECTS heading, so start there and
  // advance the cursor past each match — an identical company name earlier in
  // the document is never linked, and duplicate project names each resolve
  // to their own run. Every project advances the cursor, linked or not.
  const headingIndex = documentXml.indexOf('>PROJECTS</w:t>')
  let searchFrom = Math.max(0, headingIndex)

  for (const project of data.projects) {
    if (!project.name) {
      continue
    }

    const tIndex = documentXml.indexOf(
      `>${escapeRenderedText(project.name)}</w:t>`,
      searchFrom,
    )
    if (tIndex === -1) {
      continue
    }

    const runStart = Math.max(
      documentXml.lastIndexOf('<w:r>', tIndex),
      documentXml.lastIndexOf('<w:r ', tIndex),
    )
    const runEnd = documentXml.indexOf('</w:r>', tIndex)
    if (runStart === -1 || runEnd === -1) {
      continue
    }
    const runEndClose = runEnd + '</w:r>'.length
    searchFrom = runEndClose

    const url = project.url.trim()
    if (!url) {
      continue
    }

    // Already inside a hyperlink — nesting would be schema-invalid. Scan back
    // to the containing paragraph start so the guard is not depth-limited.
    const paragraphStart = Math.max(
      documentXml.lastIndexOf('<w:p>', runStart),
      documentXml.lastIndexOf('<w:p ', runStart),
    )
    const before = documentXml.slice(Math.max(0, paragraphStart), runStart)
    if (
      before.lastIndexOf('<w:hyperlink') > before.lastIndexOf('</w:hyperlink>')
    ) {
      continue
    }

    const id = nextRelId(relsXml, 'rCvProj', counter)
    relEntries.push(hyperlinkRelationship(id, withScheme(url)))

    const wrapped = `<w:hyperlink r:id="${id}" w:history="1">${documentXml.slice(runStart, runEndClose)}</w:hyperlink>`
    documentXml =
      documentXml.slice(0, runStart) + wrapped + documentXml.slice(runEndClose)
    searchFrom = runStart + wrapped.length
  }

  if (relEntries.length === 0) {
    return docxBytes
  }

  relsXml = relsXml.replace(
    '</Relationships>',
    `${relEntries.join('')}</Relationships>`,
  )

  zip.file('word/document.xml', documentXml)
  zip.file('word/_rels/document.xml.rels', relsXml)

  return zip.generate({ type: 'uint8array' })
}

// Character ranges of each link's text within a skill value: first
// occurrence not overlapping an earlier link, sorted by position. Links whose
// text is missing (or empty) are dropped.
function locateSkillLinks(
  value: string,
  links: ResumeData['skills'][number]['links'],
): Array<{ start: number; end: number; url: string }> {
  const ranges: Array<{ start: number; end: number; url: string }> = []

  for (const link of links) {
    const url = link.url.trim()
    if (!link.text || !url) {
      continue
    }

    let start = value.indexOf(link.text)
    while (
      start !== -1 &&
      ranges.some(
        (range) => start < range.end && start + link.text.length > range.start,
      )
    ) {
      start = value.indexOf(link.text, start + 1)
    }
    if (start === -1) {
      continue
    }

    ranges.push({ start, end: start + link.text.length, url: withScheme(url) })
  }

  return ranges.sort((a, b) => a.start - b.start)
}

// Splits each skill line's value run into before / hyperlink / after runs
// (same formatting) for every inline link. The search starts at the SKILLS
// heading and walks the lines in order, so identical text elsewhere in the
// document is never linked; links whose text is not found are skipped.
export function linkifySkillLinks(
  docxBytes: Uint8Array,
  skills: ResumeData['skills'],
): Uint8Array {
  if (!skills.some((line) => line.links.length > 0)) {
    return docxBytes
  }

  const zip = new PizZip(docxBytes)
  const docFile = zip.file('word/document.xml')
  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (!docFile || !relsFile) {
    return docxBytes
  }

  let documentXml = ensureRelationshipsNamespace(docFile.asText())
  let relsXml = relsFile.asText()

  const headingIndex = documentXml.indexOf('>SKILLS</w:t>')
  if (headingIndex === -1) {
    return docxBytes
  }

  const counter = { value: 0 }
  const relEntries: Array<string> = []
  let searchFrom = headingIndex

  for (const line of skills) {
    // The label run ("Label:") anchors the line; the value run follows it.
    const labelIndex = documentXml.indexOf(
      `>${escapeRenderedText(`${line.label}:`)}</w:t>`,
      searchFrom,
    )
    if (labelIndex === -1) {
      continue
    }
    // Past this label even if the line is skipped, so a repeated label
    // resolves to the next line.
    searchFrom = labelIndex + 1

    if (!line.value) {
      continue
    }

    const paragraphEnd = documentXml.indexOf('</w:p>', labelIndex)
    const tIndex = documentXml.indexOf(
      `>${escapeRenderedText(line.value)}</w:t>`,
      labelIndex,
    )
    if (tIndex === -1 || (paragraphEnd !== -1 && tIndex > paragraphEnd)) {
      continue
    }

    const runStart = Math.max(
      documentXml.lastIndexOf('<w:r>', tIndex),
      documentXml.lastIndexOf('<w:r ', tIndex),
    )
    const runEnd = documentXml.indexOf('</w:r>', tIndex)
    if (runStart === -1 || runEnd === -1) {
      continue
    }
    const runEndClose = runEnd + '</w:r>'.length
    searchFrom = runEndClose

    const ranges = locateSkillLinks(line.value, line.links)
    if (ranges.length === 0) {
      continue
    }

    const runXml = documentXml.slice(runStart, runEndClose)
    const rPr = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ''
    const textRun = (text: string) =>
      `<w:r>${rPr}<w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r>`

    let replacement = ''
    let cursor = 0
    for (const range of ranges) {
      if (range.start > cursor) {
        replacement += textRun(line.value.slice(cursor, range.start))
      }
      const id = nextRelId(relsXml, 'rCvSkill', counter)
      relEntries.push(hyperlinkRelationship(id, range.url))
      replacement += `<w:hyperlink r:id="${id}" w:history="1">${textRun(line.value.slice(range.start, range.end))}</w:hyperlink>`
      cursor = range.end
    }
    if (cursor < line.value.length) {
      replacement += textRun(line.value.slice(cursor))
    }

    documentXml =
      documentXml.slice(0, runStart) +
      replacement +
      documentXml.slice(runEndClose)
    searchFrom = runStart + replacement.length
  }

  if (relEntries.length === 0) {
    return docxBytes
  }

  relsXml = relsXml.replace(
    '</Relationships>',
    `${relEntries.join('')}</Relationships>`,
  )

  zip.file('word/document.xml', documentXml)
  zip.file('word/_rels/document.xml.rels', relsXml)

  return zip.generate({ type: 'uint8array' })
}
