import type { api } from '@convex/_generated/api'
import { IconBookmark } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'

import { InlineError } from '@/components/EmptyState'
import {
  LinkPreviewCard,
  LinkPreviewCardSkeleton,
} from '@/components/LinkPreviewCard'
import { TagPicker, type TagPickerActions } from '@/components/TagPicker'
import { Button } from '@/components/ui/button'
import { DrawerBody, DrawerFooter } from '@/components/ui/drawer'
import { messageFor, MESSAGES, type ErrorMessages } from '@/modules/link/errors'
import { useLibrary, usePreview } from '@/modules/link/queries'
import { useSaveDraft } from '@/modules/save/hooks'
import { SaveError, useSaveLinkMutation } from '@/modules/save/mutations'
import { fallbackLink } from '@/modules/save/utils'

type SaveFormProps = {
  /** Normalised href. */
  url: string
  /** The title the share sent, shown and saved when the page can't be read. */
  sharedTitle: string | null
  /** The tag field, so the sheet can move focus to it. */
  tagInputRef?: React.Ref<HTMLInputElement>
  onChangeLink: () => void
  onSaved: () => void
  /** Told while a save is on its way, and after it, until this unmounts. */
  onBusyChange: (busy: boolean) => void
}

// Shown under the card when there is no preview to show.
const PREVIEW_ERRORS: ErrorMessages<
  typeof api.modules.link.nodeActions.preview
> = {
  UNAUTHORIZED: MESSAGES.UNAUTHORIZED,
  INVALID_URL: MESSAGES.INVALID_URL,
  RATE_LIMITED: 'Too many previews just now. You can still save it.',
}
const NOT_FETCHED = 'Couldn’t read this page. You can still save it.'
const PREVIEW_FAILED = 'Couldn’t load a preview. You can still save it.'

export const SaveForm = ({
  url,
  sharedTitle,
  tagInputRef,
  onChangeLink,
  onSaved,
  onBusyChange,
}: SaveFormProps) => {
  const previewQuery = usePreview(url)
  const library = useLibrary()
  const tagActionsRef = useRef<TagPickerActions>(null)

  const result = previewQuery.data
  const preview = result && 'preview' in result ? result.preview : null
  const previewError = result && 'error' in result ? result.error : null

  const draft = useSaveDraft({
    url,
    links: library.links,
    previewExisting: preview?.existing ?? null,
  })
  const { tags, existing } = draft

  const save = useSaveLinkMutation({ onSuccess: onSaved })
  const busy = save.isPending || save.isSuccess
  useEffect(() => {
    onBusyChange(busy)
    return () => onBusyChange(false)
  }, [busy, onBusyChange])

  const fallback = fallbackLink(url)
  const note = preview
    ? preview.fetched
      ? null
      : NOT_FETCHED
    : previewError
      ? messageFor(PREVIEW_ERRORS, previewError)
      : previewQuery.isError
        ? PREVIEW_FAILED
        : null

  const submit = () => {
    if (busy) return
    draft.freeze()
    save.mutate(
      {
        url,
        // With a tag still typed in the field, as on a phone, where Save is
        // tapped straight after typing.
        tags: tagActionsRef.current?.commitPending() ?? tags,
        sharedTitle,
        existingId: draft.replaceId,
      },
      { onError: draft.unfreeze },
    )
  }

  const saveError = save.error
    ? save.error instanceof SaveError
      ? save.error.message
      : MESSAGES.NETWORK
    : null

  return (
    <form
      noValidate
      // The fields scroll; Save stays pinned at the bottom of the sheet.
      data-slot="save-form"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <DrawerBody>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-3">
            <p className="line-clamp-3 min-w-0 flex-1 font-mono text-xs leading-relaxed wrap-anywhere text-muted-foreground">
              {url}
            </p>
            <Button
              type="button"
              variant="ghost"
              // 36px to look at, 44px to tap (the ::after).
              className="relative -mr-3 h-9 shrink-0 px-3 text-primary after:absolute after:inset-x-0 after:-inset-y-1"
              disabled={busy}
              onClick={onChangeLink}
            >
              Change
            </Button>
          </div>

          {existing && (
            <p className="flex items-center gap-1.5 text-sm text-foreground">
              <IconBookmark className="size-4 text-primary" aria-hidden />
              Already in your library
            </p>
          )}
        </div>

        <div>
          {preview ? (
            <LinkPreviewCard
              title={(!preview.fetched && sharedTitle) || preview.title}
              domain={preview.domain}
              description={preview.description}
              image={preview.image}
            />
          ) : previewQuery.isPending ? (
            <LinkPreviewCardSkeleton />
          ) : (
            fallback && (
              <LinkPreviewCard
                title={sharedTitle || fallback.title}
                domain={fallback.domain}
              />
            )
          )}
          {note && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {note}
            </p>
          )}
        </div>

        <TagPicker
          ref={tagInputRef}
          actionsRef={tagActionsRef}
          className="mt-2"
          value={tags}
          onChange={draft.setTags}
          suggestions={preview?.suggestedTags}
          allTags={library.tags}
          suggestionsLoading={previewQuery.isPending}
          disabled={busy}
        />
      </DrawerBody>

      <DrawerFooter className="sm:flex-col sm:justify-start">
        <InlineError>{saveError}</InlineError>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-md"
          disabled={busy}
        >
          {busy ? 'Saving…' : existing ? 'Update tags' : 'Save link'}
        </Button>
      </DrawerFooter>
    </form>
  )
}
