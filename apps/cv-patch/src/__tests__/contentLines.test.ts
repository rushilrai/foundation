import { describe, expect, it } from 'vitest'

import { getEmptyResumeData } from '../../shared/resumeSchema'
import {
  cleanListFields,
  joinLines,
  splitLines,
} from '../modules/resume/contentLines'

describe('splitLines', () => {
  it('keeps trailing spaces and blank lines while typing', () => {
    expect(splitLines('Built a pricer ')).toEqual(['Built a pricer '])
    expect(splitLines('First bullet\n')).toEqual(['First bullet', ''])
    expect(joinLines(splitLines('a \n\nb'))).toBe('a \n\nb')
  })
})

describe('cleanListFields', () => {
  it('trims list items and drops blank ones on save', () => {
    const data = {
      ...getEmptyResumeData(),
      experience: [
        {
          company: 'Acme (via Initech)',
          companyMeta: '',
          roles: [
            {
              title: ' Analyst ',
              meta: '',
              bullets: ['  Built a pricer ', '', 'Cut costs'],
            },
          ],
        },
      ],
      projects: [{ name: 'Engine', url: '', dates: '', bullets: ['x ', ''] }],
      extras: ['Chess ', '   ', ''],
    }

    const cleaned = cleanListFields(data)

    expect(cleaned.experience[0].roles[0].bullets).toEqual([
      'Built a pricer',
      'Cut costs',
    ])
    expect(cleaned.experience[0].roles[0].title).toBe(' Analyst ')
    expect(cleaned.projects[0].bullets).toEqual(['x'])
    expect(cleaned.extras).toEqual(['Chess'])
  })
})
