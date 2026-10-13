import { readFileSync } from 'node:fs'
import { ResumeDataSchema, type ResumeData } from '@shared/resumeSchema'
import PizZip from 'pizzip'
import { describe, expect, it } from 'vitest'

import { decodeBase64Template } from '../../convex/assets/resumeTemplateData'
import {
  buildContactLine,
  buildContactSegments,
  linkifyContactLine,
  linkifyProjectNames,
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

// Sample data with project links removed, for contact-line-only assertions.
const loadSampleWithoutProjectLinks = (): ResumeData => {
  const sample = loadSample()
  return {
    ...sample,
    projects: sample.projects.map((item) => ({ ...item, url: '' })),
  }
}

const readParts = (docx: Uint8Array) => {
  const zip = new PizZip(docx)
  return {
    documentXml: zip.file('word/document.xml')?.asText() ?? '',
    relsXml: zip.file('word/_rels/document.xml.rels')?.asText() ?? '',
  }
}

// Every hyperlink in the document as { text, target }, in document order.
const readHyperlinks = (docx: Uint8Array) => {
  const { documentXml, relsXml } = readParts(docx)
  return [
    ...documentXml.matchAll(
      /<w:hyperlink r:id="([^"]+)"[^>]*>[\s\S]*?<w:t[^>]*>([^<]*)<\/w:t>[\s\S]*?<\/w:hyperlink>/g,
    ),
  ].map(([, id, text]) => {
    const rel = relsXml.match(new RegExp(`<Relationship Id="${id}"[^>]*/>`))
    return { id, text, target: rel?.[0].match(/Target="([^"]+)"/)?.[1] }
  })
}

const project = (
  name: string,
  url: string,
  dates = '2024',
): ResumeData['projects'][number] => ({
  name,
  url,
  dates,
  bullets: [`Built ${name}.`],
})

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
    const data = { ...loadSampleWithoutProjectLinks(), header }
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
      ...loadSampleWithoutProjectLinks(),
      header: { ...header, email: '', links: [] },
    })

    expect(readParts(rendered).documentXml).not.toContain('<w:hyperlink')
    expect(
      linkifyContactLine(rendered, { ...header, email: '', links: [] }),
    ).toBe(rendered)
  })
})

describe('linkifyProjectNames', () => {
  it('links only projects with a url, keeping the contact links', () => {
    const data: ResumeData = {
      ...loadSample(),
      header,
      projects: [
        project('Risk Engine', 'github.com/janedoe/risk-engine'),
        project('Unlinked Study', ''),
      ],
    }
    const rendered = renderResumeTemplate(decodeBase64Template(), data)
    const { documentXml } = readParts(rendered)
    const links = readHyperlinks(rendered)

    expect(links.map(({ text, target }) => ({ text, target }))).toEqual([
      { text: 'jane.doe@example.com', target: 'mailto:jane.doe@example.com' },
      { text: 'LinkedIn', target: 'https://www.linkedin.com/in/janedoe' },
      { text: 'GitHub', target: 'https://github.com/janedoe' },
      { text: 'janedoe.dev', target: 'https://www.janedoe.dev/' },
      { text: 'Risk Engine', target: 'https://github.com/janedoe/risk-engine' },
    ])
    expect(new Set(links.map(({ id }) => id)).size).toBe(links.length)
    expect(documentXml.match(/xmlns:r=/g)).toHaveLength(1)
    expect(documentXml).toContain('>Unlinked Study</w:t>')

    // The wrapped run keeps the template's bold project-name formatting.
    const wrapped = documentXml.match(
      /<w:hyperlink r:id="rCvProj\d+"[^>]*>([\s\S]*?)<\/w:hyperlink>/,
    )?.[1]
    expect(wrapped).toContain('<w:b />')
    expect(wrapped).toContain('>Risk Engine</w:t>')
  })

  it('links each project to its own run: duplicates, quotes, unlinked, earlier company', () => {
    const sample = loadSample()
    const data: ResumeData = {
      ...sample,
      header: { ...header, email: '', links: [] },
      experience: [{ ...sample.experience[0], company: 'Twin' }],
      projects: [
        project('Twin', 'https://example.com/one'),
        project("Jane's Twin", 'https://example.com/quoted'),
        project('Twin', '', 'Unlinked 2025'),
        project('Twin', 'https://example.com/two', 'Linked 2026'),
      ],
    }
    const rendered = renderResumeTemplate(decodeBase64Template(), data)
    const { documentXml } = readParts(rendered)

    expect(
      readHyperlinks(rendered).map(({ text, target }) => ({ text, target })),
    ).toEqual([
      { text: 'Twin', target: 'https://example.com/one' },
      { text: 'Jane&apos;s Twin', target: 'https://example.com/quoted' },
      { text: 'Twin', target: 'https://example.com/two' },
    ])
    // The last link sits on the fourth project's line, not the unlinked third.
    const lastLink = documentXml.lastIndexOf('<w:hyperlink')
    const lastLinkLine = documentXml.slice(
      lastLink,
      documentXml.indexOf('</w:p>', lastLink),
    )
    expect(lastLinkLine).toContain('Linked 2026')
    expect(lastLinkLine).not.toContain('Unlinked 2025')
    // The identical company name above the PROJECTS heading stays plain.
    expect(documentXml.indexOf('<w:hyperlink')).toBeGreaterThan(
      documentXml.indexOf('>PROJECTS</w:t>'),
    )
  })

  it('is a no-op when no project has a url', () => {
    const data: ResumeData = {
      ...loadSample(),
      projects: [project('Unlinked Study', '')],
    }
    const rendered = renderResumeTemplate(decodeBase64Template(), data)

    expect(linkifyProjectNames(rendered, data)).toBe(rendered)
  })

  it('does not nest a hyperlink inside an existing one', () => {
    const data: ResumeData = {
      ...loadSample(),
      projects: [project('Risk Engine', 'https://example.com/risk')],
    }
    const once = renderResumeTemplate(decodeBase64Template(), data)

    expect(linkifyProjectNames(once, data)).toBe(once)
  })
})
