import type { Doc } from '@convex/_generated/dataModel'
import {
  IconCheck,
  IconExternalLink,
  IconRefresh,
  IconShare2,
} from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { ConfirmDelete } from '@/components/ConfirmDelete'
import { InlineError } from '@/components/EmptyState'
import { cn } from '@/components/lib/utils'
import { TagPicker } from '@/components/TagPicker'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Skeleton } from '@/components/ui/skeleton'
import type { ClientDates } from '../hooks'
import { useRemoveLink, useRetrySummary, useUpdateLinkTags } from '../mutations'
import { shareLink } from '../share'

// Matches STUCK_AFTER_MS in convex/modules/link/mutations.ts: a pending
// summary this far past its due time may be retried.
const STUCK_AFTER_MS = 10 * 60_000

type LinkDetailSheetProps = {
  /** The live link, or null when the sheet is closed. */
  link: Doc<'links'> | null
  onClose: () => void
  /** Every tag the user has, for autocomplete. */
  allTags: readonly string[]
  dates: ClientDates
  /** Where focus goes when the sheet closes, as Base UI's `finalFocus`. */
  finalFocus?: () => HTMLElement | boolean | null
}

/** A saved link in full: summary, tags, open, share and delete. */
export const LinkDetailSheet = ({
  link,
  onClose,
  allTags,
  dates,
  finalFocus,
}: LinkDetailSheetProps) => {
  // Keep showing the last link while the sheet animates closed.
  const [shown, setShown] = useState(link)
  if (link && link !== shown) setShown(link)

  const openRef = useRef<HTMLAnchorElement>(null)

  return (
    <Drawer
      open={link !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DrawerContent
        // Not the tag field: that would raise the keyboard on a phone.
        initialFocus={openRef}
        finalFocus={finalFocus}
      >
        {shown && (
          <LinkDetail
            key={shown._id}
            link={shown}
            allTags={allTags}
            dates={dates}
            openRef={openRef}
            onDeleted={onClose}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

type LinkDetailProps = {
  link: Doc<'links'>
  allTags: readonly string[]
  dates: ClientDates
  openRef: React.Ref<HTMLAnchorElement>
  onDeleted: () => void
}

const LinkDetail = ({
  link,
  allTags,
  dates,
  openRef,
  onDeleted,
}: LinkDetailProps) => {
  return (
    <>
      <DrawerHeader>
        <DrawerTitle className="text-pretty wrap-anywhere">
          {link.title}
        </DrawerTitle>
        <DrawerDescription className="truncate font-mono text-[0.6875rem]">
          {link.domain}
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-[0.6875rem] leading-relaxed break-all text-faint-foreground select-text">
            {link.url}
          </p>
          {link.description && (
            <p className="text-sm leading-normal text-pretty wrap-anywhere text-muted-foreground">
              {link.description}
            </p>
          )}
        </div>

        <Summary link={link} />

        <p className="font-mono text-[0.6875rem] text-faint-foreground">
          Saved {formatSavedAt(link.savedAt, dates.timeZone)}
        </p>

        <TagEditor link={link} allTags={allTags} />

        <Actions link={link} openRef={openRef} />

        <div className="-mx-3 border-t pt-2">
          <DeleteLink link={link} onDeleted={onDeleted} />
        </div>
      </DrawerBody>
    </>
  )
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[0.6875rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
    {children}
  </h3>
)

const formatSavedAt = (savedAt: number, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
    .format(savedAt)
    .replace(', ', ' at ')

// ---------------------------------------------------------------------------

const RETRY_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'You’re signed out. Sign in again.',
  NOT_FOUND: 'This link is no longer in your library.',
  NOT_RETRYABLE: 'The summary is already on its way.',
  RATE_LIMITED: 'Too many tries for now. Try again later.',
}

const Summary = ({ link }: { link: Doc<'links'> }) => {
  const retrySummary = useRetrySummary()
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read per render; the sheet re-renders whenever the link changes.
  const now = Date.now()
  const stuck =
    link.summaryStatus === 'pending' &&
    link.summaryDueAt !== undefined &&
    link.summaryDueAt < now - STUCK_AFTER_MS
  const canRetry = link.summaryStatus === 'failed' || stuck

  const retry = async () => {
    setRetrying(true)
    setError(null)
    try {
      const result = await retrySummary({ linkId: link._id })
      if ('error' in result) setError(RETRY_ERRORS[result.error])
    } catch (caught) {
      console.error('Error retrying the summary', caught)
      setError('Couldn’t reach Webcase. Try again.')
    } finally {
      setRetrying(false)
    }
  }

  if (link.summaryStatus === 'ready' && !link.summary) return null

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Summary</SectionLabel>

      {link.summaryStatus === 'ready' ? (
        <p className="text-[0.9375rem] leading-relaxed text-pretty wrap-anywhere text-foreground">
          {link.summary}
        </p>
      ) : link.summaryStatus === 'pending' && !stuck ? (
        <div className="flex flex-col gap-2 py-1" role="status">
          <span className="sr-only">Summary on its way</span>
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-11/12 rounded-full" />
          <Skeleton className="h-3 w-2/3 rounded-full" />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {stuck ? 'The summary is taking a while.' : 'Couldn’t summarise.'}
          </p>
          {canRetry && (
            <Button
              variant="ghost"
              className="-mr-3 h-11 gap-1.5 px-3 text-primary hover:text-primary"
              disabled={retrying}
              onClick={retry}
            >
              <IconRefresh
                className={cn(
                  'size-4',
                  retrying && 'animate-spin motion-reduce:animate-none',
                )}
                aria-hidden
              />
              {retrying ? 'Retrying…' : 'Retry'}
            </Button>
          )}
        </div>
      )}

      <InlineError>{error}</InlineError>
    </section>
  )
}

// ---------------------------------------------------------------------------

type TagSave =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'failed'; message: string }

const TAG_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'You’re signed out, so the tags weren’t saved.',
  NOT_FOUND: 'This link is no longer in your library.',
}

const sameTags = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((tag, index) => tag === b[index])

/** Saves on every change; the latest change wins. */
const TagEditor = ({
  link,
  allTags,
}: {
  link: Doc<'links'>
  allTags: readonly string[]
}) => {
  const updateTags = useUpdateLinkTags()
  // The user's edit until the server has it; null shows the live tags.
  const [draft, setDraft] = useState<string[] | null>(null)
  const [save, setSave] = useState<TagSave>({ status: 'idle' })
  const requestRef = useRef(0)

  const tags = draft ?? link.tags

  const send = async (next: string[]) => {
    const request = ++requestRef.current
    setSave({ status: 'saving' })
    try {
      const result = await updateTags({ linkId: link._id, tags: next })
      if (request !== requestRef.current) return
      if ('error' in result) {
        setSave({ status: 'failed', message: TAG_ERRORS[result.error] })
      } else {
        // The live query already carries the new tags.
        setDraft(null)
        setSave({ status: 'saved' })
      }
    } catch (error) {
      if (request !== requestRef.current) return
      console.error('Error saving tags', error)
      setSave({
        status: 'failed',
        message: 'Couldn’t save the tags. Check your connection.',
      })
    }
  }

  // "Saved" fades after a moment.
  useEffect(() => {
    if (save.status !== 'saved') return
    const timer = setTimeout(() => setSave({ status: 'idle' }), 2000)
    return () => clearTimeout(timer)
  }, [save.status])

  return (
    <div className="flex flex-col gap-1.5">
      <TagPicker
        value={tags}
        allTags={allTags}
        onChange={(next) => {
          if (sameTags(next, tags)) return
          setDraft(next)
          void send(next)
        }}
        error={
          save.status === 'failed' && (
            <>
              {save.message}{' '}
              {draft && (
                <button
                  type="button"
                  onClick={() => void send(draft)}
                  className="rounded-sm font-medium underline underline-offset-2 outline-hidden focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
                >
                  Try again
                </button>
              )}
            </>
          )
        }
      />
      <p
        aria-live="polite"
        className="flex h-4 items-center gap-1 font-mono text-[0.6875rem] text-faint-foreground"
      >
        {save.status === 'saving' && 'Saving…'}
        {save.status === 'saved' && (
          <>
            <IconCheck className="size-3" aria-hidden />
            Saved
          </>
        )}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

const Actions = ({
  link,
  openRef,
}: {
  link: Doc<'links'>
  openRef: React.Ref<HTMLAnchorElement>
}) => {
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  )

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  const share = async () => {
    const outcome = await shareLink(link)
    if (outcome === 'copied') setNotice({ text: 'Link copied', error: false })
    else if (outcome === 'failed') {
      setNotice({ text: 'Couldn’t copy the link.', error: true })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          className="h-11 flex-1 px-5"
          nativeButton={false}
          render={
            <a
              ref={openRef}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Open link
          <IconExternalLink data-icon="inline-end" aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </Button>
        <Button variant="outline" className="h-11 gap-1.5 px-4" onClick={share}>
          <IconShare2 className="size-4" aria-hidden />
          Share
        </Button>
      </div>
      <p
        role="status"
        className={cn(
          'h-4 text-center font-mono text-[0.6875rem]',
          notice?.error ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {notice?.text}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

const DELETE_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'You’re signed out. Sign in again to delete.',
}

const DeleteLink = ({
  link,
  onDeleted,
}: {
  link: Doc<'links'>
  onDeleted: () => void
}) => {
  const removeLink = useRemoveLink()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <ConfirmDelete
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
      pending={pending}
      error={error}
      onConfirm={async () => {
        setPending(true)
        setError(null)
        try {
          const result = await removeLink({ linkId: link._id })
          // NOT_FOUND: it is already gone, which is what was asked for.
          if ('error' in result && result.error !== 'NOT_FOUND') {
            setError(DELETE_ERRORS[result.error])
            return
          }
          setOpen(false)
          onDeleted()
        } catch (caught) {
          console.error('Error deleting the link', caught)
          setError('Couldn’t delete the link. Try again.')
        } finally {
          setPending(false)
        }
      }}
    />
  )
}
