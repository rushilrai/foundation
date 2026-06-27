import { readFileSync } from 'node:fs'
import { ResumeDataSchema } from '@shared/resumeSchema'
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
})
