import { useUIMessages } from '@convex-dev/agent/react'
import { api } from '@convex/_generated/api.js'
import { useQuery } from 'convex/react'

import type { ProfileId } from '@/modules/profile/schema'
import type { PatchId } from './schema'

export function usePatchesForProfile(profileId: ProfileId) {
  return useQuery(api.modules.patch.queries.listForProfile, { profileId })
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
