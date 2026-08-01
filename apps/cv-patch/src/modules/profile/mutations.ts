import { optimisticallySendMessage } from '@convex-dev/agent/react'
import { api } from '@convex/_generated/api.js'
import { useAction, useMutation } from 'convex/react'

export function useCreateProfile() {
  return useMutation(api.modules.profile.mutations.create)
}

export function useUpdateProfileData() {
  return useMutation(api.modules.profile.mutations.updateData)
}

export function useRemoveProfile() {
  return useMutation(api.modules.profile.mutations.remove)
}

export function useSendProfileMessage() {
  return useMutation(
    api.modules.profile.mutations.sendMessage,
  ).withOptimisticUpdate((store, args) => {
    if (args.threadId) {
      optimisticallySendMessage(api.modules.profile.queries.listThreadMessages)(
        store,
        { threadId: args.threadId, prompt: args.prompt },
      )
    }
  })
}

export function useCreateDocument() {
  return useMutation(api.modules.profile.mutations.createDocument)
}

export function useRemoveDocument() {
  return useMutation(api.modules.profile.mutations.removeDocument)
}

export function useGenerateProfileUploadUrl() {
  return useAction(api.modules.profile.actions.generateUploadUrl)
}

export function useGenerateDocumentDownloadUrl() {
  return useAction(api.modules.profile.actions.generateDocumentDownloadUrl)
}
