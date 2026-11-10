import fs from 'node:fs'
import path from 'node:path'
import Docxtemplater from 'docxtemplater'
import expressions from 'docxtemplater/expressions.js'
import PizZip from 'pizzip'

const templatePath = path.resolve(
  process.cwd(),
  'convex/assets/resume-template.docx',
)
const dataPath = path.resolve(process.cwd(), 'scripts/sample-data.json')
const outputPath = path.resolve(process.cwd(), 'scripts/rendered-sample.docx')

const content = fs.readFileSync(templatePath, 'binary')
const zip = new PizZip(content)
const fileTypeConfig = Docxtemplater.FileTypeConfig.docx()
fileTypeConfig.getTemplatedFiles = () => ['word/document.xml']

const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  parser: expressions,
  fileTypeConfig,
})

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

// Mirrors buildContactLine and splitCompany in
// convex/modules/patch/docxTemplate.ts (labels only; the real render
// additionally hyperlinks email, links, project names and skill links).
const displayUrl = (url) =>
  url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

const contactLine = [
  data.header.phone,
  data.header.email,
  ...data.header.links.map((link) => link.label.trim() || displayUrl(link.url)),
  data.header.location,
]
  .map((part) => part.trim())
  .filter(Boolean)
  .join('      ')

const splitCompany = (company) => {
  const match = company.match(/^(.*\S\s+)(\([^()]*\))\s*$/)
  return match
    ? { companyName: match[1], companySuffix: match[2] }
    : { companyName: company, companySuffix: '' }
}

doc.render({
  ...data,
  header: { ...data.header, contactLine },
  experience: data.experience.map((entry) => ({
    ...entry,
    ...splitCompany(entry.company),
  })),
})

const buffer = doc.getZip().generate({ type: 'nodebuffer' })
fs.writeFileSync(outputPath, buffer)

console.log(`Rendered template -> ${outputPath}`)
