import type { ResumeData } from '../../../shared/resumeSchema'

const BULLET_MIN_RATIO = 0.8
const BULLET_MAX_RATIO = 1
const EDITABLE_MIN_RATIO = 0.65
const EDITABLE_MAX_RATIO = 1

export function validatePatchedData(
  data: ResumeData,
  base: ResumeData,
): Array<string> {
  const issues: Array<string> = []

  if (data.header.name !== base.header.name) {
    issues.push(
      `header.name was changed from "${base.header.name}" to "${data.header.name}" — must be identical`,
    )
  }
  if (data.header.email !== base.header.email) {
    issues.push(
      `header.email was changed from "${base.header.email}" to "${data.header.email}" — must be identical`,
    )
  }
  if (data.header.phone !== base.header.phone) {
    issues.push(
      `header.phone was changed from "${base.header.phone}" to "${data.header.phone}" — must be identical`,
    )
  }

  // ?? [] guards against base resumes that predate the header.links migration
  const baseLinks = base.header.links ?? []
  const dataLinks = data.header.links ?? []

  if (dataLinks.length !== baseLinks.length) {
    issues.push(
      `header.links has ${dataLinks.length} entries, expected ${baseLinks.length}`,
    )
  } else {
    for (let i = 0; i < baseLinks.length; i++) {
      const bLink = baseLinks[i]
      const dLink = dataLinks[i]

      if (dLink.label !== bLink.label || dLink.url !== bLink.url) {
        issues.push(
          `header.links[${i}] was changed from "${bLink.label}: ${bLink.url}" to "${dLink.label}: ${dLink.url}" — must be identical`,
        )
      }
    }
  }

  if (data.experience.length !== base.experience.length) {
    issues.push(
      `experience has ${data.experience.length} entries, expected ${base.experience.length}`,
    )
  } else {
    for (let i = 0; i < base.experience.length; i++) {
      const bExp = base.experience[i]
      const dExp = data.experience[i]

      if (dExp.company !== bExp.company) {
        issues.push(
          `experience[${i}].company was changed from "${bExp.company}" to "${dExp.company}" — must be identical`,
        )
      }
      if (dExp.companyMeta !== bExp.companyMeta) {
        issues.push(
          `experience[${i}].companyMeta was changed from "${bExp.companyMeta}" to "${dExp.companyMeta}" — must be identical`,
        )
      }

      if (dExp.roles.length !== bExp.roles.length) {
        issues.push(
          `experience[${i}].roles has ${dExp.roles.length} roles, expected ${bExp.roles.length}`,
        )
      } else {
        for (let r = 0; r < bExp.roles.length; r++) {
          const bRole = bExp.roles[r]
          const dRole = dExp.roles[r]

          if (dRole.meta !== bRole.meta) {
            issues.push(
              `experience[${i}].roles[${r}].meta was changed from "${bRole.meta}" to "${dRole.meta}" — must be identical`,
            )
          }

          validateLengthRange(
            issues,
            `experience[${i}].roles[${r}].title`,
            bRole.title,
            dRole.title,
            EDITABLE_MIN_RATIO,
            EDITABLE_MAX_RATIO,
          )

          if (dRole.bullets.length !== bRole.bullets.length) {
            issues.push(
              `experience[${i}].roles[${r}].bullets has ${dRole.bullets.length} bullets, expected ${bRole.bullets.length}`,
            )
          } else {
            for (let b = 0; b < bRole.bullets.length; b++) {
              validateLengthRange(
                issues,
                `experience[${i}].roles[${r}].bullets[${b}]`,
                bRole.bullets[b],
                dRole.bullets[b],
                BULLET_MIN_RATIO,
                BULLET_MAX_RATIO,
              )
            }
          }
        }
      }
    }
  }

  if (data.education.length !== base.education.length) {
    issues.push(
      `education has ${data.education.length} entries, expected ${base.education.length}`,
    )
  } else {
    for (let i = 0; i < base.education.length; i++) {
      const bEdu = base.education[i]
      const dEdu = data.education[i]

      if (dEdu.school !== bEdu.school) {
        issues.push(
          `education[${i}].school was changed from "${bEdu.school}" to "${dEdu.school}" — must be identical`,
        )
      }
      if (dEdu.location !== bEdu.location) {
        issues.push(
          `education[${i}].location was changed from "${bEdu.location}" to "${dEdu.location}" — must be identical`,
        )
      }
      if (dEdu.dates !== bEdu.dates) {
        issues.push(
          `education[${i}].dates was changed from "${bEdu.dates}" to "${dEdu.dates}" — must be identical`,
        )
      }

      validateLengthRange(
        issues,
        `education[${i}].degree`,
        bEdu.degree,
        dEdu.degree,
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )
      validateLengthRange(
        issues,
        `education[${i}].details`,
        bEdu.details,
        dEdu.details,
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )
    }
  }

  if (data.projects.length !== base.projects.length) {
    issues.push(
      `projects has ${data.projects.length} entries, expected ${base.projects.length}`,
    )
  } else {
    for (let i = 0; i < base.projects.length; i++) {
      const bProj = base.projects[i]
      const dProj = data.projects[i]

      if (dProj.dates !== bProj.dates) {
        issues.push(
          `projects[${i}].dates was changed from "${bProj.dates}" to "${dProj.dates}" — must be identical`,
        )
      }

      validateLengthRange(
        issues,
        `projects[${i}].name`,
        bProj.name,
        dProj.name,
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )

      if (dProj.bullets.length !== bProj.bullets.length) {
        issues.push(
          `projects[${i}].bullets has ${dProj.bullets.length} bullets, expected ${bProj.bullets.length}`,
        )
      } else {
        for (let b = 0; b < bProj.bullets.length; b++) {
          validateLengthRange(
            issues,
            `projects[${i}].bullets[${b}]`,
            bProj.bullets[b],
            dProj.bullets[b],
            BULLET_MIN_RATIO,
            BULLET_MAX_RATIO,
          )
        }
      }
    }
  }

  if (data.extras.length !== base.extras.length) {
    issues.push(
      `extras has ${data.extras.length} entries, expected ${base.extras.length}`,
    )
  } else {
    for (let i = 0; i < base.extras.length; i++) {
      validateLengthRange(
        issues,
        `extras[${i}]`,
        base.extras[i],
        data.extras[i],
        EDITABLE_MIN_RATIO,
        EDITABLE_MAX_RATIO,
      )
    }
  }

  validateLengthRange(
    issues,
    'skills.technical',
    base.skills.technical,
    data.skills.technical,
    EDITABLE_MIN_RATIO,
    EDITABLE_MAX_RATIO,
  )
  validateLengthRange(
    issues,
    'skills.financial',
    base.skills.financial,
    data.skills.financial,
    EDITABLE_MIN_RATIO,
    EDITABLE_MAX_RATIO,
  )
  validateLengthRange(
    issues,
    'skills.languages',
    base.skills.languages,
    data.skills.languages,
    EDITABLE_MIN_RATIO,
    EDITABLE_MAX_RATIO,
  )

  return issues
}

function validateLengthRange(
  issues: Array<string>,
  path: string,
  baseValue: string,
  newValue: string,
  minRatio: number,
  maxRatio: number,
): void {
  const originalLength = baseValue.length
  if (originalLength === 0) {
    return
  }

  const minLength = Math.floor(originalLength * minRatio)
  const maxLength = Math.ceil(originalLength * maxRatio)
  const nextLength = newValue.length

  if (nextLength < minLength || nextLength > maxLength) {
    issues.push(
      `${path} is ${nextLength} chars, allowed range is ${minLength}-${maxLength} (original: ${originalLength})`,
    )
  }
}
