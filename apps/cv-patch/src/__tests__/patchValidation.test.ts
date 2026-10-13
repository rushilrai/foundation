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

  it('flags a removed bullet', () => {
    const base = loadSample()
    const patched = structuredClone(base)
    patched.experience[0].roles[0].bullets.pop()

    expect(validatePatchedData(patched, base)).toEqual([
      expect.stringMatching(/^experience\[0\]\.roles\[0\]\.bullets has/),
    ])
  })
})
