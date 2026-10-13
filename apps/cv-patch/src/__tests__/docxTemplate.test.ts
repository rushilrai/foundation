import { readFileSync } from 'node:fs'
import { ResumeDataSchema, type ResumeData } from '@shared/resumeSchema'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'

import { decodeBase64Template } from '../../convex/assets/resumeTemplateData'
import {
  buildContactLine,
  buildContactSegments,
  linkifyContactLine,
  renderResumeTemplate,
} from '../../convex/modules/patch/docxTemplate'

const SEP = '    '

const header: ResumeData['header'] = {
  name: 'Jane Doe',
  phone: '+1 555 010 1234',
  email: 'jane.doe@example.com',
  location: 'London, UK',
  links: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/janedoe' },
    { label: 'GitHub', url: 'github.com/janedoe' },
    { label: '', url: 'https://www.janedoe.dev/' },
  ],
}

const loadSample = (): ResumeData => {
  const samplePath = new URL('../../scripts/sample-data.json', import.meta.url)
  return ResumeDataSchema.parse(JSON.parse(readFileSync(samplePath, 'utf-8')))
}

const readParts = (docx: Uint8Array) => {
  const zip = new PizZip(docx)
  return {
    documentXml: zip.file('word/document.xml')?.asText() ?? '',
    relsXml: zip.file('word/_rels/document.xml.rels')?.asText() ?? '',
  }
}

describe('buildContactSegments', () => {
  it('renders labels only, with mailto for email, url hrefs for links and plain location', () => {
    expect(buildContactSegments(header)).toEqual([
      { text: '+1 555 010 1234' },
      { text: SEP },
      { text: 'jane.doe@example.com', href: 'mailto:jane.doe@example.com' },
      { text: SEP },
      { text: 'LinkedIn', href: 'https://www.linkedin.com/in/janedoe' },
      { text: SEP },
      { text: 'GitHub', href: 'https://github.com/janedoe' },
      { text: SEP },
      { text: 'janedoe.dev', href: 'https://www.janedoe.dev/' },
      { text: SEP },
      { text: 'London, UK' },
    ])
  })

  it('skips empty parts without doubling separators', () => {
    const segments = buildContactSegments({
      ...header,
      phone: '  ',
      location: '',
      links: [{ label: 'GitHub', url: 'github.com/janedoe' }],
    })

    expect(segments).toEqual([
      { text: 'jane.doe@example.com', href: 'mailto:jane.doe@example.com' },
      { text: SEP },
      { text: 'GitHub', href: 'https://github.com/janedoe' },
    ])
  })

  it('joins into the plain contact line', () => {
    expect(buildContactLine(header)).toBe(
      [
        '+1 555 010 1234',
        'jane.doe@example.com',
        'LinkedIn',
        'GitHub',
        'janedoe.dev',
        'London, UK',
      ].join(SEP),
    )
  })
})

describe('renderResumeTemplate', () => {
  it('turns the email and link labels into hyperlinks with matching rels', () => {
    const data = { ...loadSample(), header }
    const { documentXml, relsXml } = readParts(
      renderResumeTemplate(decodeBase64Template(), data),
    )

    expect(documentXml).toContain('xmlns:r=')
    expect(documentXml).not.toContain('{header.contactLine}')

    const hyperlinks = [
      ...documentXml.matchAll(
        /<w:hyperlink r:id="([^"]+)"[^>]*>[\s\S]*?<w:t[^>]*>([^<]*)<\/w:t>[\s\S]*?<\/w:hyperlink>/g,
      ),
    ].map(([, id, text]) => ({ id, text }))

    expect(hyperlinks.map((link) => link.text)).toEqual([
      'jane.doe@example.com',
      'LinkedIn',
      'GitHub',
      'janedoe.dev',
    ])

    const targets = hyperlinks.map(({ id }) => {
      const rel = relsXml.match(
        new RegExp(`<Relationship Id="${id}"[^>]*/>`),
      )?.[0]
      expect(rel).toContain('relationships/hyperlink')
      expect(rel).toContain('TargetMode="External"')
      return rel?.match(/Target="([^"]+)"/)?.[1]
    })

    expect(targets).toEqual([
      'mailto:jane.doe@example.com',
      'https://www.linkedin.com/in/janedoe',
      'https://github.com/janedoe',
      'https://www.janedoe.dev/',
    ])

    // Location and phone stay as plain runs on the contact line.
    expect(documentXml).toContain('>London, UK</w:t>')
    expect(documentXml).toContain('>+1 555 010 1234</w:t>')
  })

  it('leaves the document untouched when nothing is linkable', () => {
    const rendered = renderResumeTemplate(decodeBase64Template(), {
      ...loadSample(),
      header: { ...header, email: '', links: [] },
    })

    expect(readParts(rendered).documentXml).not.toContain('<w:hyperlink')
    expect(
      linkifyContactLine(rendered, { ...header, email: '', links: [] }),
    ).toBe(rendered)
  })
})
