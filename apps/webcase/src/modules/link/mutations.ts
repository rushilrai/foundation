import { useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'

export function useUpdateLinkTags() {
  return useConvexMutation(api.modules.link.mutations.updateTags)
}

export function useRemoveLink() {
  return useConvexMutation(api.modules.link.mutations.remove)
}

export function useRetrySummary() {
  return useConvexMutation(api.modules.link.mutations.retrySummary)
}

export function useAskLibrary() {
  return useConvexAction(api.modules.link.nodeActions.ask)
}
