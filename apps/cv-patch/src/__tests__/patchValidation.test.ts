import { readFileSync } from 'node:fs'
import { ResumeDataSchema, type ResumeData } from '@shared/resumeSchema'
import { describe, expect, it } from 'vitest'

import { validatePatchedData } from '../../convex/modules/patch/validation'

const loadSample = (): ResumeData => {
  const samplePath = new URL('../../scripts/sample-data.json', import.meta.url)
  return ResumeDataSchema.parse(JSON.parse(readFileSync(samplePath, 'utf-8')))
}

describe('validatePatchedData', () => {
  it('passes identical data', () => {
    const base = loadSample()
    expect(validatePatchedData(structuredClone(base), base)).toEqual([])
  })

  it('flags a changed header.location', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.header.location = 'London'

    const issues = validatePatchedData(patched, base)

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatch(/^header\.location was changed/)
  })

  it('flags a location added where the base had none', () => {
    const base = loadSample()
    base.header.location = ''
    const patched = structuredClone(base)
    patched.header.location = 'Remote'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^header\.location was changed/),
    ])
  })

  it('flags a changed header link url', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.header.links[0].url = 'linkedin.com/in/someone-else'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^header\.links\[0\] was changed/),
    ])
  })

  it('flags a dropped header link', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.header.links.pop()

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^header\.links has 1 entries, expected 2/),
    ])
  })

  it('flags a changed company name', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.experience[0].company = 'Another Co'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^experience\[0\]\.company was changed/),
    ])
  })

  it('flags a bullet that grows past its original length', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    const bullets = patched.experience[0].roles[0].bullets
    bullets[0] = `${bullets[0]} and more`

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(
        /^experience\[0\]\.roles\[0\]\.bullets\[0\] is \d+ chars/,
      ),
    ])
  })

  it('flags a changed project name, even within the old length range', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.projects[0].name = 'Open Source Analytics'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^projects\[0\]\.name was changed/),
    ])
  })

  it('flags a changed project url', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.projects[0].url = 'https://github.com/janedoe/other'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^projects\[0\]\.url was changed/),
    ])
  })

  it('flags a project url added where the base had none', () => {
    const base = loadSample()
    base.projects[0].url = ''
    const patched = structuredClone(base)
    patched.projects[0].url = 'https://github.com/janedoe/oss-dashboard'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^projects\[0\]\.url was changed/),
    ])
  })

  it('flags a removed bullet', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.experience[0].roles[0].bullets.pop()

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^experience\[0\]\.roles\[0\]\.bullets has/),
    ])
  })

  it('passes a skill value reordered within the length range', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.skills[1].value =
      'Scrum Master (In progress), AWS Certified Developer (Associate)'
    patched.skills[0].value = 'Docker, PostgreSQL, Node.js, React, TypeScript'

    expect(validatePatchedData(patched, base)).toEqual([])
  })

  it('flags a changed skill label', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.skills[0].label = 'Tech Stack'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^skills\[0\]\.label was changed/),
    ])
  })

  it('flags a changed skill link', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.skills[1].links[0].url = 'https://example.com/other'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^skills\[1\]\.links\[0\] was changed/),
    ])
  })

  it('flags a dropped skill link', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.skills[1].links = []

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^skills\[1\]\.links has 0 entries, expected 1/),
    ])
  })

  it('flags a skill value that no longer contains its link text', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.skills[1].value =
      'AWS Certified Dev (Associate), Scrum Master (In progress)'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(
        /^skills\[1\]\.value must contain the link text "AWS Certified Developer"/,
      ),
    ])
  })

  it('flags a value with fewer occurrences than links sharing a text', () => {
    const base = loadSample()
    base.skills[1] = {
      label: 'Certifications',
      value: 'CFA (Passed), CFA (Level II candidate)',
      links: [
        { text: 'CFA', url: 'https://example.com/cfa-1' },
        { text: 'CFA', url: 'https://example.com/cfa-2' },
      ],
    }
    const patched = structuredClone(base)
    patched.skills[1].value = 'CFA (Passed), Level II candidate (CFA)'

    expect(validatePatchedData(patched, base)).toEqual([])

    patched.skills[1].value = 'CFA (Passed), Level II candidate (CF.)'

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(
        /^skills\[1\]\.value must contain the link text "CFA" verbatim 2 times/,
      ),
    ])
  })

  it('flags a changed skill line count', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.skills.pop()

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^skills has 2 lines, expected 3/),
    ])
  })

  it('flags a skill value that grows past its original length', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.skills[0].value = `${patched.skills[0].value}, Kubernetes`

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^skills\[0\]\.value is \d+ chars/),
    ])
  })
})
