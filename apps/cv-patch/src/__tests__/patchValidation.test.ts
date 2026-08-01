import { getEmptyProfileData, type ProfileData } from '@shared/profileSchema'
import type { ResumeData } from '@shared/resumeSchema'
import { describe, expect, it } from 'vitest'

import { validatePatchedData } from '../../convex/modules/patch/validation'

function buildProfile(): ProfileData {
  const profile = getEmptyProfileData()
  profile.header = {
    name: 'Ada Lovelace',
    phone: '+44 1234 567890',
    email: 'ada@example.com',
    location: 'London, UK',
    links: [
      { label: 'LinkedIn', url: 'https://linkedin.com/in/ada' },
      { label: 'GitHub', url: 'https://github.com/ada' },
    ],
  }
  profile.education = [
    {
      school: 'University of London',
      location: 'London',
      dates: '2018 – 2021',
      degree: 'BSc Mathematics',
      details: 'First-class honours',
    },
  ]
  profile.experience = [
    {
      company: 'Analytical Engines Ltd',
      companyMeta: 'London · Fintech',
      roles: [
        {
          title: 'Software Engineer',
          meta: 'Jan 2022 – Present',
          bullets: ['Built the trading engine', 'Cut latency 40%'],
        },
      ],
    },
    {
      company: 'Babbage & Co',
      companyMeta: 'Remote',
      roles: [
        {
          title: 'Analyst',
          meta: '2021 – 2022',
          bullets: ['Modelled risk for 12 desks'],
        },
      ],
    },
  ]
  profile.projects = [
    {
      name: 'Difference Engine',
      url: 'https://github.com/ada/difference-engine',
      dates: '2023',
      bullets: ['Simulated mechanical computation'],
    },
    {
      name: 'Notes Translator',
      url: '',
      dates: '2024',
      bullets: ['Translated scientific memoirs'],
    },
  ]
  profile.skills = {
    technical: 'TypeScript, Python',
    financial: 'Risk modelling',
    languages: 'English, French',
  }
  return profile
}

// A legitimate curation: subset of entries, reworded titles/names/bullets.
function buildCuratedResume(profile: ProfileData): ResumeData {
  return {
    header: {
      ...profile.header,
      // Links may be selected and reordered.
      links: [profile.header.links[1], profile.header.links[0]],
    },
    education: [
      {
        school: profile.education[0].school,
        location: profile.education[0].location,
        dates: profile.education[0].dates,
        degree: 'BSc Mathematics (reworded for the JD)',
        details: 'Graduated first in class',
      },
    ],
    experience: [
      {
        company: profile.experience[0].company,
        companyMeta: profile.experience[0].companyMeta,
        roles: [
          {
            title: 'Backend Engineer',
            meta: profile.experience[0].roles[0].meta,
            bullets: ['Shipped a trading engine that cut latency 40%'],
          },
        ],
      },
    ],
    projects: [
      {
        name: 'Difference Engine simulator',
        url: profile.projects[0].url,
        dates: profile.projects[0].dates,
        bullets: ['Recreated mechanical computation in software'],
      },
    ],
    skills: profile.skills,
    extras: [],
  }
}

describe('validatePatchedData (grounding)', () => {
  it('accepts a legitimate curated subset with reworded text', () => {
    const profile = buildProfile()
    expect(validatePatchedData(buildCuratedResume(profile), profile)).toEqual(
      [],
    )
  })

  it('rejects changed contact facts', () => {
    const profile = buildProfile()
    const data = buildCuratedResume(profile)
    data.header.email = 'other@example.com'
    data.header.location = 'Paris'

    const issues = validatePatchedData(data, profile)
    expect(issues.some((issue) => issue.includes('header.email'))).toBe(true)
    expect(issues.some((issue) => issue.includes('header.location'))).toBe(true)
  })

  it('rejects invented header links but allows selection/reorder', () => {
    const profile = buildProfile()
    const data = buildCuratedResume(profile)
    expect(validatePatchedData(data, profile)).toEqual([])

    data.header.links = [{ label: 'Portfolio', url: 'https://ada.dev' }]
    const issues = validatePatchedData(data, profile)
    expect(issues.some((issue) => issue.includes('Portfolio'))).toBe(true)
  })

  it('rejects companies that are not in the profile', () => {
    const profile = buildProfile()
    const data = buildCuratedResume(profile)
    data.experience[0] = {
      ...data.experience[0],
      company: 'Invented Corp',
    }

    const issues = validatePatchedData(data, profile)
    expect(issues.some((issue) => issue.includes('Invented Corp'))).toBe(true)
  })

  it('rejects role meta that does not exist at that company', () => {
    const profile = buildProfile()
    const data = buildCuratedResume(profile)
    data.experience[0].roles[0].meta = 'Mar 2019 – Dec 2021'

    const issues = validatePatchedData(data, profile)
    expect(issues.some((issue) => issue.includes('roles[0].meta'))).toBe(true)
  })

  it('accepts duplicate-company profiles by checking every entry', () => {
    const profile = buildProfile()
    // Boomerang employment: same company twice with different meta.
    profile.experience.push({
      company: 'Analytical Engines Ltd',
      companyMeta: 'London · Second stint',
      roles: [
        { title: 'Staff Engineer', meta: '2025', bullets: ['Led infra'] },
      ],
    })

    const data = buildCuratedResume(profile)
    data.experience.push({
      company: 'Analytical Engines Ltd',
      companyMeta: 'London · Second stint',
      roles: [
        { title: 'Staff Engineer', meta: '2025', bullets: ['Led infra'] },
      ],
    })

    expect(validatePatchedData(data, profile)).toEqual([])
  })

  it('rejects project facts blended across profile entries', () => {
    const profile = buildProfile()
    const data = buildCuratedResume(profile)
    // Project 0's url with project 1's dates.
    data.projects[0].dates = profile.projects[1].dates

    const issues = validatePatchedData(data, profile)
    expect(issues.some((issue) => issue.includes('projects[0]'))).toBe(true)
  })

  it('rejects empty bullets and an empty resume', () => {
    const profile = buildProfile()
    const data = buildCuratedResume(profile)
    data.experience[0].roles[0].bullets = []
    expect(
      validatePatchedData(data, profile).some((issue) =>
        issue.includes('no bullets'),
      ),
    ).toBe(true)

    const empty = {
      ...buildCuratedResume(profile),
      experience: [],
      projects: [],
    }
    expect(
      validatePatchedData(empty, profile).some((issue) =>
        issue.includes('no experience and no projects'),
      ),
    ).toBe(true)
  })
})
