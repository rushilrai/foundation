import type { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { LinkPreview } from '@convex/modules/link/nodeActions'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  messageFor,
  MESSAGES,
  type ErrorCode,
  type ErrorMessages,
} from '@/modules/link/errors'
import { useCreateLink, useUpdateLinkTags } from '@/modules/link/mutations'
import { previewQuery, type PreviewResult } from '@/modules/link/queries'
import { fallbackLink } from './utils'

// How long Save waits for a preview that is still loading before it saves
// the link under its host and path instead.
const PREVIEW_GRACE_MS = 2_500

export class SaveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SaveError'
  }
}

type SaveErrorCode =
  | ErrorCode<typeof api.modules.link.mutations.create>
  | ErrorCode<typeof api.modules.link.mutations.updateTags>

const SAVE_MESSAGES: ErrorMessages<typeof api.modules.link.mutations.create> &
  ErrorMessages<typeof api.modules.link.mutations.updateTags> = {
  UNAUTHORIZED: MESSAGES.UNAUTHORIZED,
  INVALID_URL: MESSAGES.INVALID_URL,
  NOT_FOUND: MESSAGES.NOT_FOUND,
  RATE_LIMITED: 'You’ve saved a lot in a short time. Try again in a minute.',
}

const failWith = (code: SaveErrorCode): never => {
  throw new SaveError(messageFor(SAVE_MESSAGES, code))
}

export type SaveInput = {
  /** Normalised href of the link being saved. */
  url: string
  tags: string[]
  /** The title the share sent, used when the page itself can't be read. */
  sharedTitle: string | null
  /**
   * The saved link whose tags the picker started from. Only then are the
   * tags replaced; otherwise `create` merges them into any existing link.
   */
  existingId: Id<'links'> | null
}

const wait = (ms: number) =>
  new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))

// Saves a new link, or replaces an existing one's tags. A preview still on
// its way gets a short grace period; without one the link is saved under
// its host and path.
export function useSaveLinkMutation({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient()
  const create = useCreateLink()
  const updateTags = useUpdateLinkTags()

  const settledPreview = async (url: string): Promise<LinkPreview | null> => {
    const query = previewQuery(url)
    const state = queryClient.getQueryState<PreviewResult>(query.queryKey)
    const result =
      state?.status === 'pending'
        ? await Promise.race([
            queryClient.fetchQuery(query).catch(() => null),
            wait(PREVIEW_GRACE_MS),
          ])
        : state?.data
    return result && 'preview' in result ? result.preview : null
  }

  return useMutation({
    mutationFn: async ({ url, tags, sharedTitle, existingId }: SaveInput) => {
      if (existingId) {
        const result = await updateTags({ linkId: existingId, tags })
        if ('success' in result) return
        // Deleted meanwhile: save it afresh below.
        if (result.error !== 'NOT_FOUND') failWith(result.error)
      }

      const preview = await settledPreview(url)
      const link = preview ?? fallbackLink(url)
      if (!link) return failWith('INVALID_URL')

      const result = await create({
        url: link.url,
        title: (!preview?.fetched && sharedTitle) || link.title,
        domain: link.domain,
        description: preview?.description,
        image: preview?.image,
        tags,
      })
      if ('error' in result) failWith(result.error)
    },
    onSuccess,
  })
}
