import { readFileSync } from 'node:fs'
import {
  getEmptyResumeData,
  isDocxFileName,
  ResumeDataSchema,
} from '@shared/resumeSchema'
import { describe, expect, it } from 'vitest'

describe('ResumeDataSchema', () => {
  it('validates sample resume data', () => {
    const samplePath = new URL(
      '../../scripts/sample-data.json',
      import.meta.url,
    )
    const sample = JSON.parse(readFileSync(samplePath, 'utf-8'))

    expect(() => ResumeDataSchema.parse(sample)).not.toThrow()
  })

  it('requires a url on every project', () => {
    const samplePath = new URL(
      '../../scripts/sample-data.json',
      import.meta.url,
    )
    const sample = JSON.parse(readFileSync(samplePath, 'utf-8'))
    delete sample.projects[0].url

    expect(ResumeDataSchema.safeParse(sample).success).toBe(false)
  })

  it('parses skills as labelled lines with inline links', () => {
    const samplePath = new URL(
      '../../scripts/sample-data.json',
      import.meta.url,
    )
    const sample = ResumeDataSchema.parse(
      JSON.parse(readFileSync(samplePath, 'utf-8')),
    )

    expect(sample.skills.map((line) => line.label)).toEqual([
      'Technical',
      'Certifications',
      'Languages',
    ])
    expect(sample.skills[1].links).toEqual([
      {
        text: 'AWS Certified Developer',
        url: 'https://example.com/certs/aws-developer',
      },
    ])
  })

  it('rejects the old fixed skills object and links without a url', () => {
    const samplePath = new URL(
      '../../scripts/sample-data.json',
      import.meta.url,
    )
    const sample = JSON.parse(readFileSync(samplePath, 'utf-8'))

    expect(
      ResumeDataSchema.safeParse({
        ...sample,
        skills: { technical: 'TypeScript', financial: '', languages: '' },
      }).success,
    ).toBe(false)

    delete sample.skills[1].links[0].url
    expect(ResumeDataSchema.safeParse(sample).success).toBe(false)
  })

  it('has no skill lines in empty data', () => {
    expect(getEmptyResumeData().skills).toEqual([])
    expect(ResumeDataSchema.safeParse(getEmptyResumeData()).success).toBe(true)
  })
})

describe('isDocxFileName', () => {
  it('accepts .docx names only', () => {
    expect(isDocxFileName('resume.docx')).toBe(true)
    expect(isDocxFileName('Resume.DOCX')).toBe(true)
    expect(isDocxFileName('notes.txt')).toBe(false)
    expect(isDocxFileName('resume.pdf')).toBe(false)
    expect(isDocxFileName('resume.doc')).toBe(false)
    expect(isDocxFileName('docx')).toBe(false)
  })
})
