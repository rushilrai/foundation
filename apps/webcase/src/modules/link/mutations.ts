import { useConvexAction, useConvexMutation } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { MAX_QUESTION_LENGTH } from '@shared/limits'
import { useMutation } from '@tanstack/react-query'

import { messageFor, MESSAGES, type ErrorMessages } from './errors'

// The one place the link mutations and actions are wrapped. Screens and
// the save and import modules build on these.

export function useCreateLink() {
  return useConvexMutation(api.modules.link.mutations.create)
}

export function useUpdateLinkTags() {
  return useConvexMutation(api.modules.link.mutations.updateTags)
}

export function useRemoveLink() {
  return useConvexMutation(api.modules.link.mutations.remove)
}

export function useRetrySummary() {
  return useConvexMutation(api.modules.link.mutations.retrySummary)
}

export function useImportLinks() {
  return useConvexMutation(api.modules.link.mutations.importMany)
}

function useAskLibrary() {
  return useConvexAction(api.modules.link.nodeActions.ask)
}

// ---------------------------------------------------------------------------
// Asking the library a question.

export type AskState =
  | { status: 'idle' }
  | { status: 'asking'; question: string }
  | {
      status: 'answered'
      question: string
      answer: string
      linkIds: Id<'links'>[]
    }
  | { status: 'failed'; question: string; message: string }

const ASK_ERRORS: ErrorMessages<typeof api.modules.link.nodeActions.ask> = {
  UNAUTHORIZED: MESSAGES.UNAUTHORIZED,
  INVALID_QUESTION: `Ask in ${MAX_QUESTION_LENGTH} characters or fewer.`,
  RATE_LIMITED: 'You’ve asked a lot for now. Try again later.',
  AI_UNAVAILABLE: 'Asking isn’t available right now.',
}

class AskError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AskError'
  }
}

/**
 * One question at a time. The mutation observer follows only the latest
 * call, so a reset or a newer question drops a late answer.
 */
export function useAsk() {
  const askLibrary = useAskLibrary()
  const mutation = useMutation({
    mutationFn: async (question: string) => {
      const result = await askLibrary({ question })
      if ('error' in result) {
        throw new AskError(messageFor(ASK_ERRORS, result.error))
      }
      return result
    },
    onError: (error) => {
      if (!(error instanceof AskError)) {
        console.error('Error asking the library', error)
      }
    },
  })

  const question = mutation.variables ?? ''
  const state: AskState = mutation.isPending
    ? { status: 'asking', question }
    : mutation.isError
      ? {
          status: 'failed',
          question,
          message:
            mutation.error instanceof AskError
              ? mutation.error.message
              : MESSAGES.NETWORK,
        }
      : mutation.isSuccess
        ? { status: 'answered', question, ...mutation.data }
        : { status: 'idle' }

  return { state, ask: mutation.mutate, reset: mutation.reset }
}
