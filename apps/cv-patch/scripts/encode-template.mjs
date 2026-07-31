import fs from 'node:fs'
import path from 'node:path'

const templates = [
  {
    docx: 'convex/assets/resume-template.docx',
    out: 'convex/assets/resumeTemplateData.ts',
    constName: 'RESUME_TEMPLATE_BASE64',
    decodeName: 'decodeBase64Template',
    source: 'resume-template.docx',
  },
  {
    docx: 'convex/assets/cover-letter-template.docx',
    out: 'convex/assets/coverLetterTemplateData.ts',
    constName: 'COVER_LETTER_TEMPLATE_BASE64',
    decodeName: 'decodeCoverLetterTemplate',
    source: 'cover-letter-template.docx',
  },
]

for (const template of templates) {
  const base64 = fs
    .readFileSync(path.resolve(process.cwd(), template.docx))
    .toString('base64')

  const content = `// Auto-generated from ${template.source} — do not edit manually.
// To regenerate: bun encode:template

export const ${template.constName} =
  '${base64}'

export function ${template.decodeName}(): Uint8Array {
  return new Uint8Array(Buffer.from(${template.constName}, 'base64'))
}
`

  fs.writeFileSync(path.resolve(process.cwd(), template.out), content)

  console.log(`Encoded ${template.docx} -> ${template.out}`)
}
