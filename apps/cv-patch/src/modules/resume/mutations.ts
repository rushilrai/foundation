import { api } from '@convex/_generated/api.js'
import { useAction, useMutation } from 'convex/react'

export function useCreateResume() {
  return useMutation(api.modules.resume.mutations.create)
}

export function useUpdateResumeData() {
  return useMutation(api.modules.resume.mutations.updateData)
}

export function useGenerateResumeUploadUrl() {
  return useAction(api.modules.resume.actions.generateUploadUrl)
}

export function useGenerateResumeDownloadUrl() {
  return useAction(api.modules.resume.actions.generateDownloadUrl)
}

export function useGenerateResumePdfDownloadUrl() {
  return useAction(api.modules.resume.actions.generatePdfDownloadUrl)
}
