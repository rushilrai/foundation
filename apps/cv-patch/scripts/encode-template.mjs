import fs from 'node:fs'
import path from 'node:path'

const templatePath = path.resolve(
  process.cwd(),
  'convex/assets/resume-template.docx',
)
const outputPath = path.resolve(
  process.cwd(),
  'convex/assets/resumeTemplateData.ts',
)

const base64 = fs.readFileSync(templatePath).toString('base64')

const content = `// Auto-generated from resume-template.docx — do not edit manually.
// To regenerate: bun encode:template

export const RESUME_TEMPLATE_BASE64 =
  '${base64}'

export function decodeBase64Template(): Uint8Array {
  return new Uint8Array(Buffer.from(RESUME_TEMPLATE_BASE64, 'base64'))
}
`

fs.writeFileSync(outputPath, content)

console.log(`Encoded template -> ${outputPath}`)
