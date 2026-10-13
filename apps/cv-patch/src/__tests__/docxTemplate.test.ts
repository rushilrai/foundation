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
  linkifySkillLinks,
  renderResumeTemplate,
  splitCompany,
} from '../../convex/modules/patch/docxTemplate'

// Six spaces, matching the original resume's contact line.
const SEP = '      '

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

// Sample data with project and skill links removed, for contact-line-only
// assertions.
const loadSampleWithoutBodyLinks = (): ResumeData => {
  const sample = loadSample()
  return {
    ...sample,
    projects: sample.projects.map((item) => ({ ...item, url: '' })),
    skills: sample.skills.map((line) => ({ ...line, links: [] })),
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
    const data = { ...loadSampleWithoutBodyLinks(), header }
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
      ...loadSampleWithoutBodyLinks(),
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
      {
        text: 'AWS Certified Developer',
        target: 'https://example.com/certs/aws-developer',
      },
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
      skills: [],
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

// Runs of the first company line (the first paragraph after the PROFESSIONAL
// EXPERIENCE heading), each as its xml and text.
const readCompanyRuns = (documentXml: string) => {
  const heading = documentXml.indexOf('>PROFESSIONAL EXPERIENCE</w:t>')
  const start = documentXml.indexOf('<w:p', heading)
  const paragraph = documentXml.slice(
    start,
    documentXml.indexOf('</w:p>', start),
  )
  return [...paragraph.matchAll(/<w:r>[\s\S]*?<\/w:r>/g)].map(([xml]) => ({
    xml,
    text: xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/)?.[1] ?? '',
  }))
}

const BOLD = '<w:b />'
const ITALIC = '<w:i />'

describe('splitCompany', () => {
  it('splits a trailing parenthetical off the company name', () => {
    expect(splitCompany('Morgan Stanley (via Accolite)')).toEqual({
      companyName: 'Morgan Stanley ',
      companySuffix: '(via Accolite)',
    })
    expect(splitCompany('AntPod (Agri-Tech Startup)')).toEqual({
      companyName: 'AntPod ',
      companySuffix: '(Agri-Tech Startup)',
    })
  })

  it('keeps names without a trailing parenthetical whole', () => {
    for (const company of [
      'Acme Corp',
      'Acme (UK) Ltd',
      '(Stealth)',
      'Acme (a (b))',
      '',
    ]) {
      expect(splitCompany(company)).toEqual({
        companyName: company,
        companySuffix: '',
      })
    }
  })
})

describe('company line', () => {
  const render = (company: string, companyMeta: string) => {
    const sample = loadSampleWithoutBodyLinks()
    const data: ResumeData = {
      ...sample,
      experience: [{ ...sample.experience[0], company, companyMeta }],
    }
    return readCompanyRuns(
      readParts(renderResumeTemplate(decodeBase64Template(), data)).documentXml,
    ).filter(({ text }) => text)
  }

  it('renders the name bold and a trailing parenthetical italic, not bold', () => {
    const [name, suffix, meta] = render(
      'Morgan Stanley (via Accolite)',
      'Chennai, IN | Mar 2021 - May 2021',
    )

    expect(name.text).toBe('Morgan Stanley ')
    expect(name.xml).toContain(BOLD)
    expect(name.xml).not.toContain(ITALIC)
    expect(suffix.text).toBe('(via Accolite)')
    expect(suffix.xml).toContain(ITALIC)
    expect(suffix.xml).not.toContain(BOLD)
    expect(meta.text).toBe('Chennai, IN | Mar 2021 - May 2021')
  })

  it('renders a name without a parenthetical as a single bold run', () => {
    const runs = render('Acme Corp', 'London, UK')

    expect(runs.map(({ text }) => text)).toEqual(['Acme Corp', 'London, UK'])
    expect(runs[0].xml).toContain(BOLD)
    expect(runs[0].xml).not.toContain(ITALIC)
  })

  it('renders the right-hand company meta bold', () => {
    const meta = render('Acme Corp', 'London, UK').at(-1)

    expect(meta?.text).toBe('London, UK')
    expect(meta?.xml).toContain(BOLD)
    expect(meta?.xml).not.toContain(ITALIC)
  })

  it('keeps contact, project and skill links with a split company name', () => {
    const sample = loadSample()
    const data: ResumeData = {
      ...sample,
      header,
      experience: [
        { ...sample.experience[0], company: 'Risk Engine (via Agency)' },
      ],
      projects: [project('Risk Engine', 'github.com/janedoe/risk-engine')],
    }
    const rendered = renderResumeTemplate(decodeBase64Template(), data)

    expect(
      readHyperlinks(rendered).map(({ text, target }) => ({ text, target })),
    ).toEqual([
      { text: 'jane.doe@example.com', target: 'mailto:jane.doe@example.com' },
      { text: 'LinkedIn', target: 'https://www.linkedin.com/in/janedoe' },
      { text: 'GitHub', target: 'https://github.com/janedoe' },
      { text: 'janedoe.dev', target: 'https://www.janedoe.dev/' },
      { text: 'Risk Engine', target: 'https://github.com/janedoe/risk-engine' },
      {
        text: 'AWS Certified Developer',
        target: 'https://example.com/certs/aws-developer',
      },
    ])
    expect(
      readCompanyRuns(readParts(rendered).documentXml)
        .map(({ text }) => text)
        .filter(Boolean),
    ).toEqual(['Risk Engine ', '(via Agency)', 'London, UK'])
  })
})

// Skill-line paragraphs between the SKILLS heading and the next section
// heading, each as its xml and its concatenated text. The empty spacer
// paragraph that closes the section (it has no runs) is skipped.
const readSkillParagraphs = (documentXml: string) => {
  const start = documentXml.indexOf('>SKILLS</w:t>')
  const end = documentXml.indexOf('>EXTRA-CURRICULAR', start)
  const section = documentXml.slice(
    documentXml.indexOf('</w:p>', start) + '</w:p>'.length,
    documentXml.lastIndexOf('<w:p', end),
  )
  return [...section.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .filter(([xml]) => xml.includes('<w:r>'))
    .map(([xml]) => ({
      xml,
      text: [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map(([, text]) => text)
        .join(''),
    }))
}

const skillLine = (
  label: string,
  value: string,
  links: ResumeData['skills'][number]['links'] = [],
): ResumeData['skills'][number] => ({ label, value, links })

describe('linkifySkillLinks', () => {
  it('renders one paragraph per skill line with a bold label run', () => {
    const data: ResumeData = {
      ...loadSampleWithoutBodyLinks(),
      skills: [
        skillLine('Quantitative Methods', 'Derivatives Pricing, Greeks'),
        skillLine('Technical', 'Python, SQL'),
        skillLine('Financial Systems & Tools', 'Bloomberg Terminal, Excel'),
        skillLine('Certifications', 'CFA Level I (Passed)'),
        skillLine('Languages', 'English (native)'),
      ],
    }
    const { documentXml } = readParts(
      renderResumeTemplate(decodeBase64Template(), data),
    )
    const paragraphs = readSkillParagraphs(documentXml)

    expect(paragraphs.map(({ text }) => text)).toEqual([
      'Quantitative Methods: Derivatives Pricing, Greeks',
      'Technical: Python, SQL',
      'Financial Systems &amp; Tools: Bloomberg Terminal, Excel',
      'Certifications: CFA Level I (Passed)',
      'Languages: English (native)',
    ])
    for (const { xml } of paragraphs) {
      const runs = [...xml.matchAll(/<w:r>[\s\S]*?<\/w:r>/g)].map(
        ([run]) => run,
      )
      expect(runs[0]).toContain('<w:b />')
      expect(runs[0]).toMatch(/:<\/w:t>/)
      expect(runs.slice(1).join('')).not.toContain('<w:b />')
    }
    // The old fixed skill labels are gone from the template.
    expect(documentXml).not.toContain('Technical Skills')
    expect(documentXml).not.toContain('Financial Skills')
    expect(documentXml).not.toContain('{skills')
  })

  it('links the phrase inside its own line only, keeping contact and project links', () => {
    const sample = loadSample()
    const certUrl = 'https://example.com/certs/aws-developer'
    const data: ResumeData = {
      ...sample,
      header,
      experience: [
        {
          ...sample.experience[0],
          roles: [
            {
              ...sample.experience[0].roles[0],
              bullets: ['Earned AWS Certified Developer'],
            },
          ],
        },
      ],
      projects: [project('Risk Engine', 'github.com/janedoe/risk-engine')],
      skills: [
        skillLine('Technical', 'AWS Certified Developer tooling, Python'),
        skillLine(
          'Certifications',
          'AWS Certified Developer (Associate), Scrum Master (In progress)',
          [{ text: 'AWS Certified Developer', url: certUrl }],
        ),
      ],
      extras: ['AWS Certified Developer'],
    }
    const rendered = renderResumeTemplate(decodeBase64Template(), data)
    const { documentXml, relsXml } = readParts(rendered)
    const links = readHyperlinks(rendered)

    expect(links.map(({ text, target }) => ({ text, target }))).toEqual([
      { text: 'jane.doe@example.com', target: 'mailto:jane.doe@example.com' },
      { text: 'LinkedIn', target: 'https://www.linkedin.com/in/janedoe' },
      { text: 'GitHub', target: 'https://github.com/janedoe' },
      { text: 'janedoe.dev', target: 'https://www.janedoe.dev/' },
      { text: 'Risk Engine', target: 'https://github.com/janedoe/risk-engine' },
      { text: 'AWS Certified Developer', target: certUrl },
    ])
    expect(new Set(links.map(({ id }) => id)).size).toBe(links.length)
    expect(relsXml.match(/Id="rCvSkill\d+"/g)).toHaveLength(1)

    const [technical, certifications] = readSkillParagraphs(documentXml)
    expect(technical.xml).not.toContain('<w:hyperlink')
    expect(certifications.text).toBe(
      'Certifications: AWS Certified Developer (Associate), Scrum Master (In progress)',
    )
    expect(certifications.xml.match(/<w:hyperlink /g)).toHaveLength(1)
    // Split runs keep the value run's regular-weight formatting.
    expect(certifications.xml).toMatch(
      /<w:hyperlink r:id="rCvSkill\d+" w:history="1"><w:r><w:rPr>(?:(?!<w:b \/>)[\s\S])*?<\/w:rPr><w:t xml:space="preserve">AWS Certified Developer<\/w:t><\/w:r><\/w:hyperlink><w:r><w:rPr>[\s\S]*?<\/w:rPr><w:t xml:space="preserve"> \(Associate\), Scrum Master \(In progress\)<\/w:t><\/w:r>/,
    )
    // The bullet and the extras line with the same text stay plain.
    expect(documentXml).toContain('>Earned AWS Certified Developer</w:t>')
    const extrasIndex = documentXml.indexOf('>EXTRA-CURRICULAR')
    expect(
      documentXml.indexOf('>AWS Certified Developer</w:t>', extrasIndex),
    ).toBeGreaterThan(extrasIndex)
  })

  it('links several phrases in value order, skipping links whose text is missing', () => {
    const data: ResumeData = {
      ...loadSampleWithoutBodyLinks(),
      header: { ...header, email: '', links: [] },
      skills: [
        skillLine(
          'Financial Systems & Tools',
          'Bloomberg Terminal, P&L Attribution, Excel',
          [
            { text: 'P&L Attribution', url: 'example.com/pnl' },
            { text: 'Not In Value', url: 'https://example.com/missing' },
            { text: 'Bloomberg Terminal', url: 'https://example.com/bbg' },
          ],
        ),
      ],
    }
    const rendered = renderResumeTemplate(decodeBase64Template(), data)
    const [line] = readSkillParagraphs(readParts(rendered).documentXml)

    expect(
      readHyperlinks(rendered).map(({ text, target }) => ({ text, target })),
    ).toEqual([
      { text: 'Bloomberg Terminal', target: 'https://example.com/bbg' },
      { text: 'P&amp;L Attribution', target: 'https://example.com/pnl' },
    ])
    expect(line.text).toBe(
      'Financial Systems &amp; Tools: Bloomberg Terminal, P&amp;L Attribution, Excel',
    )
  })

  it('resolves a repeated label to its own line after an empty one', () => {
    const data: ResumeData = {
      ...loadSampleWithoutBodyLinks(),
      header: { ...header, email: '', links: [] },
      skills: [
        skillLine('Certifications', ''),
        skillLine('Certifications', 'CFA Level I', [
          { text: 'CFA Level I', url: 'https://example.com/cfa' },
        ]),
      ],
    }
    const rendered = renderResumeTemplate(decodeBase64Template(), data)
    const [empty, linked] = readSkillParagraphs(readParts(rendered).documentXml)

    expect(empty.xml).not.toContain('<w:hyperlink')
    expect(linked.xml.match(/<w:hyperlink /g)).toHaveLength(1)
    expect(linked.text).toBe('Certifications: CFA Level I')
  })

  it('is a no-op when no skill line has links', () => {
    const data = loadSampleWithoutBodyLinks()
    const rendered = renderResumeTemplate(decodeBase64Template(), data)

    expect(linkifySkillLinks(rendered, data.skills)).toBe(rendered)
  })
})
