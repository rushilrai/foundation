import { z } from 'zod'

export const MAX_HEADER_LINKS = 5

export const ResumeLinkSchema = z.object({
  label: z.string(),
  url: z.string(),
})

export const ResumeHeaderSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  location: z.string(),
  links: z.array(ResumeLinkSchema).max(MAX_HEADER_LINKS),
})

export const ResumeEducationSchema = z.object({
  school: z.string(),
  location: z.string(),
  dates: z.string(),
  degree: z.string(),
  details: z.string(),
})

export const ResumeRoleSchema = z.object({
  title: z.string(),
  meta: z.string(),
  bullets: z.array(z.string()),
})

export const ResumeExperienceSchema = z.object({
  company: z.string(),
  companyMeta: z.string(),
  roles: z.array(ResumeRoleSchema),
})

export const ResumeProjectSchema = z.object({
  name: z.string(),
  // Optional so documents created before profile support stay valid; absent or empty means no link.
  url: z.string().optional(),
  dates: z.string(),
  bullets: z.array(z.string()),
})

export const ResumeSkillsSchema = z.object({
  technical: z.string(),
  financial: z.string(),
  languages: z.string(),
})

export const ResumeDataSchema = z.object({
  header: ResumeHeaderSchema,
  education: z.array(ResumeEducationSchema),
  experience: z.array(ResumeExperienceSchema),
  projects: z.array(ResumeProjectSchema),
  skills: ResumeSkillsSchema,
  extras: z.array(z.string()),
})

export type ResumeLink = z.infer<typeof ResumeLinkSchema>
export type ResumeData = z.infer<typeof ResumeDataSchema>

export function getEmptyResumeData(): ResumeData {
  return {
    header: {
      name: '',
      phone: '',
      email: '',
      location: '',
      links: [],
    },
    education: [],
    experience: [],
    projects: [],
    skills: {
      technical: '',
      financial: '',
      languages: '',
    },
    extras: [],
  }
}
