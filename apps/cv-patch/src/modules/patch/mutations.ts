import { api } from '@convex/_generated/api.js'
import { useAction, useMutation } from 'convex/react'

export function useCreatePatch() {
  return useMutation(api.modules.patch.mutations.create)
}

export function useGeneratePatchDownloadUrl() {
  return useAction(api.modules.patch.actions.generateDownloadUrl)
}

export function useGeneratePatchPdfDownloadUrl() {
  return useAction(api.modules.patch.actions.generatePdfDownloadUrl)
}
