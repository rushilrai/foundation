import {
  getEmptyResumeData,
  type ResumeData,
  type ResumeSkillLine,
} from '@shared/resumeSchema'
import {
  dropMissingSkillLinks,
  findMissingSkillLinks,
  hasMissingSkillLinks,
  locateSkillLinks,
} from '@shared/skillLinks'
import { describe, expect, it } from 'vitest'

const line = (
  value: string,
  texts: Array<string>,
  label = 'Certifications',
): ResumeSkillLine => ({
  label,
  value,
  links: texts.map((text, i) => ({ text, url: `https://example.com/${i}` })),
})

const withSkills = (skills: Array<ResumeSkillLine>): ResumeData => ({
  ...getEmptyResumeData(),
  skills,
})

describe('locateSkillLinks', () => {
  it('places each link on the first free occurrence of its text', () => {
    const value = 'CFA (Passed), CFA (Level II), FRM'
    expect(
      locateSkillLinks(value, line(value, ['CFA', 'CFA', 'FRM']).links),
    ).toEqual([
      { start: 0, end: 3 },
      { start: 14, end: 17 },
      { start: 30, end: 33 },
    ])
  })

  it('returns null for empty text or text with no free occurrence', () => {
    const value = 'CFA (Passed)'
    expect(
      locateSkillLinks(value, line(value, ['', 'CFA', 'CFA']).links),
    ).toEqual([null, { start: 0, end: 3 }, null])
  })
})

describe('findMissingSkillLinks', () => {
  it('passes when every link text appears in the value', () => {
    expect(
      findMissingSkillLinks(line('CFA Level I (Passed)', ['CFA Level I'])),
    ).toEqual([])
  })

  it('flags a link whose text is not in the value', () => {
    expect(findMissingSkillLinks(line('CFA (Passed)', ['FRM']))).toEqual([0])
  })

  it('needs one occurrence per link sharing the same text', () => {
    expect(findMissingSkillLinks(line('CFA (Passed)', ['CFA', 'CFA']))).toEqual(
      [1],
    )
    expect(
      findMissingSkillLinks(
        line('CFA (Passed), CFA (Level II)', ['CFA', 'CFA']),
      ),
    ).toEqual([])
  })

  it('flags an empty link text', () => {
    expect(findMissingSkillLinks(line('CFA', ['']))).toEqual([0])
  })
})

describe('hasMissingSkillLinks', () => {
  it('is true when any skill line has a missing link text', () => {
    expect(
      hasMissingSkillLinks(
        withSkills([line('Python', [], 'Technical'), line('CFA', ['FRM'])]),
      ),
    ).toBe(true)
    expect(hasMissingSkillLinks(withSkills([line('CFA', ['CFA'])]))).toBe(false)
  })
})

describe('dropMissingSkillLinks', () => {
  it('drops only the links whose text is missing and reports them', () => {
    const data = withSkills([
      line('Python, SQL', [], 'Technical'),
      line('CFA (Passed)', ['CFA', 'FRM', 'CFA']),
    ])

    const result = dropMissingSkillLinks(data)

    expect(result.data.skills[0]).toBe(data.skills[0])
    expect(result.data.skills[1].links).toEqual([
      { text: 'CFA', url: 'https://example.com/0' },
    ])
    expect(result.dropped).toEqual([
      { line: 1, text: 'FRM', url: 'https://example.com/1' },
      { line: 1, text: 'CFA', url: 'https://example.com/2' },
    ])
  })

  it('returns the data unchanged when nothing is missing', () => {
    const data = withSkills([line('CFA (Passed)', ['CFA'])])
    const result = dropMissingSkillLinks(data)
    expect(result.data.skills).toEqual(data.skills)
    expect(result.dropped).toEqual([])
  })
})
