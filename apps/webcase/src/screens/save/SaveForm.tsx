import type { Id } from '@convex/_generated/dataModel'
import { normalizeTags } from '@shared/tags'
import { IconBookmark } from '@tabler/icons-react'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { InlineError } from '@/components/EmptyState'
import {
  LinkPreviewCard,
  LinkPreviewCardSkeleton,
} from '@/components/LinkPreviewCard'
import { TagPicker } from '@/components/TagPicker'
import { Button } from '@/components/ui/button'
import { SaveError, useSaveLinkMutation } from '@/modules/save/mutations'
import { useLibrary, usePreviewQuery } from '@/modules/save/queries'
import { fallbackLink } from '@/modules/save/utils'
import { useKeyboardInset } from './useKeyboardInset'

type SaveFormProps = {
  /** Normalised href. */
  url: string
  /** The title the share sent, shown and saved when the page can't be read. */
  sharedTitle: string | null
  onChangeLink: () => void
}

type Existing = { linkId: Id<'links'>; tags: string[] }

// Shown under a fallback card when there is no preview to show.
const PREVIEW_NOTES: Record<string, string> = {
  NOT_FETCHED: 'Couldn’t read this page. You can still save it.',
  RATE_LIMITED: 'Too many previews just now. You can still save it.',
  UNAUTHORIZED: 'You’ve been signed out. Sign in again to save.',
  INVALID_URL: 'That doesn’t look like a link.',
  FAILED: 'Couldn’t load a preview. You can still save it.',
}

export const SaveForm = ({ url, sharedTitle, onChangeLink }: SaveFormProps) => {
  const navigate = useNavigate()
  const keyboardInset = useKeyboardInset()
  const previewQuery = usePreviewQuery(url)
  const library = useLibrary()
  const [tags, setTags] = useState<string[]>([])
  // The saved link whose tags were added to the picker, once.
  const [seededFrom, setSeededFrom] = useState<Id<'links'> | null>(null)
  // What `existing` was when Save was tapped, so the page does not flip to
  // "Already in your library" as the new link arrives in the live list.
  const [frozen, setFrozen] = useState<{ existing: Existing | null } | null>(
    null,
  )

  const save = useSaveLinkMutation({
    // Replace, so Back from the library does not return to this form.
    onSuccess: () => void navigate({ to: '/', replace: true }),
  })
  const busy = save.isPending || save.isSuccess

  const result = previewQuery.data
  const preview = result && 'preview' in result ? result.preview : null
  const previewError = result && 'error' in result ? result.error : null

  // The live library is the truth once loaded: a cached preview may predate
  // saving this link. Until then the preview's own answer stands.
  const saved = library.links?.find((link) => link.url === url)
  const liveExisting: Existing | null = library.links
    ? saved
      ? { linkId: saved._id, tags: saved.tags }
      : null
    : (preview?.existing ?? null)
  const existing = frozen ? frozen.existing : liveExisting

  if (existing && seededFrom !== existing.linkId) {
    setSeededFrom(existing.linkId)
    setTags((current) => normalizeTags([...existing.tags, ...current]))
  }

  const fallback = fallbackLink(url)
  const note = preview
    ? preview.fetched
      ? null
      : PREVIEW_NOTES.NOT_FETCHED
    : previewError
      ? PREVIEW_NOTES[previewError]
      : previewQuery.isError
        ? PREVIEW_NOTES.FAILED
        : null

  const submit = () => {
    if (busy) return
    setFrozen({ existing })
    save.mutate(
      {
        url,
        tags,
        sharedTitle,
        // Replace tags only when the picker started from the saved ones.
        existingId:
          existing && existing.linkId === seededFrom ? existing.linkId : null,
      },
      { onError: () => setFrozen(null) },
    )
  }

  const saveError = save.error
    ? save.error instanceof SaveError
      ? save.error.message
      : 'Couldn’t save. Check your connection and try again.'
    : null

  return (
    <form
      noValidate
      className="flex flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="mt-3 flex items-baseline gap-3">
        <p className="line-clamp-3 min-w-0 flex-1 font-mono text-xs leading-relaxed wrap-anywhere text-muted-foreground">
          {url}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="-mr-3 h-9 shrink-0 px-3 text-primary"
          disabled={busy}
          onClick={onChangeLink}
        >
          Change
        </Button>
      </div>

      {existing && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-foreground">
          <IconBookmark className="size-4 text-primary" aria-hidden />
          Already in your library
        </p>
      )}

      <div className="mt-5">
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
        className="mt-8"
        value={tags}
        onChange={setTags}
        suggestions={preview?.suggestedTags}
        allTags={library.tags}
        suggestionsLoading={previewQuery.isPending}
        disabled={busy}
      />

      <div
        // The fade above it softens content scrolling underneath.
        className="sticky bottom-0 z-10 mt-auto bg-background pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-linear-to-t before:from-background before:to-transparent"
        style={
          keyboardInset
            ? { transform: `translateY(-${keyboardInset}px)` }
            : undefined
        }
      >
        <InlineError className="mb-3">{saveError}</InlineError>
        <Button
          type="submit"
          size="lg"
          className="h-12 w-full text-[0.9375rem]"
          disabled={busy}
        >
          {busy ? 'Saving…' : existing ? 'Update tags' : 'Save link'}
        </Button>
      </div>
    </form>
  )
}
