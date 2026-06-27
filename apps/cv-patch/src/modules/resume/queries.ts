import { api } from '@convex/_generated/api.js'
import { useQuery } from 'convex/react'

import type { ResumeId } from './schema'

export function useResumeList() {
  return useQuery(api.modules.resume.queries.list)
}

export function useResume(resumeId: ResumeId) {
  return useQuery(api.modules.resume.queries.get, { resumeId })
}
