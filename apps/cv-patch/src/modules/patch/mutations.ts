import { optimisticallySendMessage } from '@convex-dev/agent/react'
import { api } from '@convex/_generated/api.js'
import { useAction, useMutation } from 'convex/react'

export function useCreatePatch() {
  return useMutation(api.modules.patch.mutations.create)
}

export function useSendPatchMessage() {
  return useMutation(
    api.modules.patch.mutations.sendMessage,
  ).withOptimisticUpdate((store, args) => {
    if (args.threadId) {
      optimisticallySendMessage(api.modules.patch.queries.listThreadMessages)(
        store,
        { threadId: args.threadId, prompt: args.prompt },
      )
    }
  })
}

export function useRestorePatchVersion() {
  return useMutation(api.modules.patch.mutations.restoreVersion)
}

export function useGeneratePatchDownloadUrl() {
  return useAction(api.modules.patch.actions.generateDownloadUrl)
}

export function useGenerateCoverLetterDownloadUrl() {
  return useAction(api.modules.patch.actions.generateCoverLetterDownloadUrl)
}

export function useGeneratePatchPdfDownloadUrl() {
  return useAction(api.modules.patch.actions.generatePdfDownloadUrl)
}
