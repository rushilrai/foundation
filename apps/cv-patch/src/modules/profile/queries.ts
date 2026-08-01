import { useUIMessages } from '@convex-dev/agent/react'
import { api } from '@convex/_generated/api.js'
import { useQuery } from 'convex/react'

import type { ProfileId } from './schema'

export function useProfileList() {
  return useQuery(api.modules.profile.queries.list)
}

export function useProfile(profileId: ProfileId) {
  return useQuery(api.modules.profile.queries.get, { profileId })
}

export function useProfileDocuments(profileId: ProfileId) {
  return useQuery(api.modules.profile.queries.listDocuments, { profileId })
}

export function useProfileThreadMessages(threadId: string | undefined) {
  return useUIMessages(
    api.modules.profile.queries.listThreadMessages,
    threadId ? { threadId } : 'skip',
    { initialNumItems: 30, stream: true },
  )
}
