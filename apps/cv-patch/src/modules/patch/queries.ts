import { useUIMessages } from '@convex-dev/agent/react'
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

export function usePatchVersions(patchId: PatchId) {
  return useQuery(api.modules.patch.queries.listVersions, { patchId })
}

export function usePatchThreadMessages(threadId: string | undefined) {
  return useUIMessages(
    api.modules.patch.queries.listThreadMessages,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 30, stream: true },
  )
}
