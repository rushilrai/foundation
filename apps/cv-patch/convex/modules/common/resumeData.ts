import { v } from 'convex/values'

// Must stay in sync with shared/resumeSchema.ts.
export const resumeLinkValidator = v.object({
  label: v.string(),
  url: v.string(),
})

export const resumeHeaderValidator = v.object({
  name: v.string(),
  phone: v.string(),
  email: v.string(),
  location: v.string(),
  links: v.array(resumeLinkValidator),
})

export const resumeEducationValidator = v.object({
  school: v.string(),
  location: v.string(),
  dates: v.string(),
  degree: v.string(),
  details: v.string(),
})

export const resumeExperienceValidator = v.object({
  company: v.string(),
  companyMeta: v.string(),
  roles: v.array(
    v.object({
      title: v.string(),
      meta: v.string(),
      bullets: v.array(v.string()),
    }),
  ),
})

export const resumeSkillsValidator = v.object({
  technical: v.string(),
  financial: v.string(),
  languages: v.string(),
})

export const resumeDataValidator = v.object({
  header: resumeHeaderValidator,
  education: v.array(resumeEducationValidator),
  experience: v.array(resumeExperienceValidator),
  projects: v.array(
    v.object({
      name: v.string(),
      // Optional so documents created before profile support stay valid; absent or empty means no link.
      url: v.optional(v.string()),
      dates: v.string(),
      bullets: v.array(v.string()),
    }),
  ),
  skills: resumeSkillsValidator,
  extras: v.array(v.string()),
})

export const nullableResumeDataValidator = v.union(
  v.null(),
  resumeDataValidator,
)
