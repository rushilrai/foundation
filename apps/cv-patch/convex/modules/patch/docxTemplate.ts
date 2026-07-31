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

export function buildContactLine(header: ResumeData['header']): string {
  return [header.phone, header.email, ...header.links.map((link) => link.url)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(CONTACT_SEPARATOR)
}

export function renderResumeTemplate(
  templateBuffer: ArrayBuffer | Uint8Array,
  data: ResumeData,
): Uint8Array {
  return renderTemplate(templateBuffer, {
    ...data,
    header: { ...data.header, contactLine: buildContactLine(data.header) },
  })
}

export function renderCoverLetterTemplate(
  templateBuffer: ArrayBuffer | Uint8Array,
  data: CoverLetterTemplateData,
): Uint8Array {
  return renderTemplate(templateBuffer, data)
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
