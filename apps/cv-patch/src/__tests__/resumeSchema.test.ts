import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { ResumeDataSchema } from '@shared/resumeSchema'

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
