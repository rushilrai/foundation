import type { ProfileData } from '../../../shared/profileSchema'
import { MAX_HEADER_LINKS, type ResumeData } from '../../../shared/resumeSchema'

// Grounding validation: the tailored resume may curate, reorder, and reword
// freely, but every entry must trace back to the profile and contact facts
// must be untouched. Page fit is enforced separately via the rendered PDF.
export function validatePatchedData(
  data: ResumeData,
  profile: ProfileData,
): Array<string> {
  const issues: Array<string> = []
  const base = profile.header

  if (data.header.name !== base.name) {
    issues.push(
      `header.name was changed from "${base.name}" to "${data.header.name}" — must be identical to the profile`,
    )
  }
  if (data.header.email !== base.email) {
    issues.push(
      `header.email was changed from "${base.email}" to "${data.header.email}" — must be identical to the profile`,
    )
  }
  if (data.header.phone !== base.phone) {
    issues.push(
      `header.phone was changed from "${base.phone}" to "${data.header.phone}" — must be identical to the profile`,
    )
  }
  if (data.header.location !== base.location) {
    issues.push(
      `header.location was changed from "${base.location}" to "${data.header.location}" — must be identical to the profile`,
    )
  }

  if (data.header.links.length > MAX_HEADER_LINKS) {
    issues.push(`header.links has more than ${MAX_HEADER_LINKS} entries`)
  }
  for (const link of data.header.links) {
    const known = base.links.some(
      (profileLink) =>
        profileLink.label === link.label && profileLink.url === link.url,
    )
    if (!known) {
      issues.push(
        `header.links entry "${link.label}: ${link.url}" does not exist in the profile — links may be selected and reordered but not edited or invented`,
      )
    }
  }

  if (data.experience.length === 0 && data.projects.length === 0) {
    issues.push('the resume has no experience and no projects')
  }

  for (let i = 0; i < data.experience.length; i++) {
    const exp = data.experience[i]
    // A profile can legitimately repeat a company (e.g. boomerang employment),
    // so ground against every entry sharing the name.
    const candidates = profile.experience.filter(
      (candidate) => candidate.company === exp.company,
    )

    if (candidates.length === 0) {
      issues.push(
        `experience[${i}].company "${exp.company}" does not exist in the profile — company names must match the profile byte-for-byte`,
      )
      continue
    }

    const metaKnown = candidates.some(
      (candidate) => candidate.companyMeta === exp.companyMeta,
    )
    if (!metaKnown) {
      issues.push(
        `experience[${i}].companyMeta "${exp.companyMeta}" does not match any "${exp.company}" entry in the profile — must be copied exactly`,
      )
    }

    for (let r = 0; r < exp.roles.length; r++) {
      const role = exp.roles[r]

      if (role.bullets.length === 0) {
        issues.push(`experience[${i}].roles[${r}] has no bullets`)
      }

      const roleKnown = candidates.some((candidate) =>
        candidate.roles.some((profileRole) => profileRole.meta === role.meta),
      )
      if (!roleKnown) {
        issues.push(
          `experience[${i}].roles[${r}].meta "${role.meta}" does not match any role at "${exp.company}" in the profile — role dates/meta must be copied exactly`,
        )
      }
    }
  }

  for (let i = 0; i < data.education.length; i++) {
    const edu = data.education[i]
    const candidates = profile.education.filter(
      (candidate) => candidate.school === edu.school,
    )

    if (candidates.length === 0) {
      issues.push(
        `education[${i}].school "${edu.school}" does not exist in the profile — school names must match the profile byte-for-byte`,
      )
      continue
    }

    const known = candidates.some(
      (candidate) =>
        candidate.location === edu.location && candidate.dates === edu.dates,
    )
    if (!known) {
      issues.push(
        `education[${i}] location/dates ("${edu.location}", "${edu.dates}") do not match any "${edu.school}" entry in the profile — must be copied exactly`,
      )
    }
  }

  for (let i = 0; i < data.projects.length; i++) {
    const project = data.projects[i]
    const url = project.url?.trim() ?? ''

    if (project.bullets.length === 0) {
      issues.push(`projects[${i}] has no bullets`)
    }

    // Names may be reworded, so projects are grounded by their factual fields.
    // One single profile project must supply BOTH the dates and the url —
    // mixing fields across entries is fact-blending.
    const grounded = profile.projects.some(
      (candidate) =>
        candidate.dates === project.dates &&
        (url === '' || candidate.url.trim() === url),
    )
    if (!grounded) {
      issues.push(
        `projects[${i}] (dates "${project.dates}"${url ? `, url "${url}"` : ''}) does not match a single profile project — copy dates and url exactly from the same profile entry`,
      )
    }
  }

  return issues
}
