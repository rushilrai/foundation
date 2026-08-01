import { v } from 'convex/values'

import {
  resumeEducationValidator,
  resumeExperienceValidator,
  resumeHeaderValidator,
  resumeSkillsValidator,
} from './resumeData'

// Must stay in sync with shared/profileSchema.ts.
export const profileProjectValidator = v.object({
  name: v.string(),
  url: v.string(),
  dates: v.string(),
  bullets: v.array(v.string()),
})

export const profileVoiceValidator = v.object({
  sampleCoverLetter: v.string(),
  styleNotes: v.string(),
  personalNotes: v.string(),
})

export const profileDataValidator = v.object({
  roleBrief: v.string(),
  header: resumeHeaderValidator,
  education: v.array(resumeEducationValidator),
  experience: v.array(resumeExperienceValidator),
  projects: v.array(profileProjectValidator),
  skills: resumeSkillsValidator,
  extras: v.array(v.string()),
  voice: profileVoiceValidator,
})
