import { v } from 'convex/values'

// Single source of truth for the ResumeData shape on the Convex side.
// Must stay in sync with shared/resumeSchema.ts (Zod).
export const resumeLinkValidator = v.object({
  label: v.string(),
  url: v.string(),
})

export const resumeHeaderValidator = v.object({
  name: v.string(),
  phone: v.string(),
  email: v.string(),
  links: v.array(resumeLinkValidator),
})

export const resumeDataValidator = v.object({
  header: resumeHeaderValidator,
  education: v.array(
    v.object({
      school: v.string(),
      location: v.string(),
      dates: v.string(),
      degree: v.string(),
      details: v.string(),
    }),
  ),
  experience: v.array(
    v.object({
      company: v.string(),
      companyMeta: v.string(),
      roles: v.array(
        v.object({
          title: v.string(),
          meta: v.string(),
          bullets: v.array(v.string()),
        }),
      ),
    }),
  ),
  projects: v.array(
    v.object({
      name: v.string(),
      dates: v.string(),
      bullets: v.array(v.string()),
    }),
  ),
  skills: v.object({
    technical: v.string(),
    financial: v.string(),
    languages: v.string(),
  }),
  extras: v.array(v.string()),
})

export const nullableResumeDataValidator = v.union(
  v.null(),
  resumeDataValidator,
)
