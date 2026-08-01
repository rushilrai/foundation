import { getEmptyProfileData, ProfileDataSchema } from '@shared/profileSchema'
import { ResumeDataSchema } from '@shared/resumeSchema'
import { describe, expect, it } from 'vitest'

describe('ProfileDataSchema', () => {
  it('validates an empty profile', () => {
    expect(() => ProfileDataSchema.parse(getEmptyProfileData())).not.toThrow()
  })

  it('requires a url on profile projects', () => {
    const data = getEmptyProfileData()
    data.projects.push({
      name: 'cv-patch',
      url: 'https://github.com/example/cv-patch',
      dates: '2026',
      bullets: ['Built a resume tailoring agent'],
    })

    expect(() => ProfileDataSchema.parse(data)).not.toThrow()

    const { url: _url, ...withoutUrl } = data.projects[0]
    expect(() =>
      ProfileDataSchema.parse({ ...data, projects: [withoutUrl] }),
    ).toThrow()
  })
})

describe('ResumeDataSchema project url', () => {
  it('accepts projects with and without a url', () => {
    const project = { name: 'cv-patch', dates: '2026', bullets: [] }

    expect(() =>
      ResumeDataSchema.pick({ projects: true }).parse({ projects: [project] }),
    ).not.toThrow()
    expect(() =>
      ResumeDataSchema.pick({ projects: true }).parse({
        projects: [{ ...project, url: 'https://example.com' }],
      }),
    ).not.toThrow()
  })
})
