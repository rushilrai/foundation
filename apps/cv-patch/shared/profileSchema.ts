import { z } from 'zod'

import {
  ResumeEducationSchema,
  ResumeExperienceSchema,
  ResumeHeaderSchema,
  ResumeSkillsSchema,
} from './resumeSchema'

// Empty string means the project has no link.
export const ProfileProjectSchema = z.object({
  name: z.string(),
  url: z.string(),
  dates: z.string(),
  bullets: z.array(z.string()),
})

export const ProfileVoiceSchema = z.object({
  sampleCoverLetter: z.string(),
  styleNotes: z.string(),
  personalNotes: z.string(),
})

export const ProfileDataSchema = z.object({
  roleBrief: z.string(),
  header: ResumeHeaderSchema,
  education: z.array(ResumeEducationSchema),
  experience: z.array(ResumeExperienceSchema),
  projects: z.array(ProfileProjectSchema),
  skills: ResumeSkillsSchema,
  extras: z.array(z.string()),
  voice: ProfileVoiceSchema,
})

export type ProfileProject = z.infer<typeof ProfileProjectSchema>
export type ProfileVoice = z.infer<typeof ProfileVoiceSchema>
export type ProfileData = z.infer<typeof ProfileDataSchema>

export function getEmptyProfileData(): ProfileData {
  return {
    roleBrief: '',
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
    voice: {
      sampleCoverLetter: '',
      styleNotes: '',
      personalNotes: '',
    },
  }
}
