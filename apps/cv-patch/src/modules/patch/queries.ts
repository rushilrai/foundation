import { api } from '@convex/_generated/api.js'
import { useQuery } from 'convex/react'

import type { ResumeId } from '@/modules/resume/schema'
import type { PatchId } from './schema'

export function usePatchesForResume(resumeId: ResumeId) {
  return useQuery(api.modules.patch.queries.listForResume, { resumeId })
}

export function usePatch(patchId: PatchId) {
  return useQuery(api.modules.patch.queries.get, { patchId })
}
