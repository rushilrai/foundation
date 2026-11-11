import type { Doc, Id } from '@convex/_generated/dataModel'
import { MAX_QUESTION_LENGTH } from '@shared/limits'
import { normalizeTag, type TagCount } from '@shared/tags'
import { IconSparkles } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { AddLinkButton } from '@/components/AddLinkButton'
import { AnswerCard } from '@/components/AnswerCard'
import { EmptyState, InlineError } from '@/components/EmptyState'
import { LibraryHeader } from '@/components/LibraryHeader'
import { MonthHeading } from '@/components/MonthHeading'
import { SearchField } from '@/components/SearchField'
import { TagFilterBar } from '@/components/TagFilterBar'
import { Button } from '@/components/ui/button'
import { useSignOutMutation } from '@/modules/auth/mutations'
import { useCurrentUser } from '@/modules/auth/queries'
import { LinkDetailSheet } from '@/modules/link/components/LinkDetailSheet'
import {
  LinkItem,
  LinkList,
  LinkListSkeleton,
} from '@/modules/link/components/LinkList'
import {
  useAsk,
  useClientDates,
  type AskState,
  type ClientDates,
} from '@/modules/link/hooks'
import { useLinks } from '@/modules/link/queries'
import { filterLinks, isQuestion, searchWords } from '@/modules/link/search'
import { countTags } from '@/modules/link/utils'
import { AccountMenu } from './AccountMenu'

type HomeScreenProps = {
  /** The tag filter from the URL, or undefined for all links. */
  tag: string | undefined
  onTagChange: (tag: string | null) => void
}

export const HomeScreen = ({ tag: tagParam, onTagChange }: HomeScreenProps) => {
  const user = useCurrentUser()
  const signOut = useSignOutMutation()
  const linksQuery = useLinks()
  const dates = useClientDates()

  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const { state: askState, ask, reset: resetAsk } = useAsk()
  const [selectedId, setSelectedId] = useState<Id<'links'> | null>(null)

  const activeTag = (tagParam && normalizeTag(tagParam)) || null

  const links =
    linksQuery.data && 'links' in linksQuery.data
      ? linksQuery.data.links
      : undefined

  const byId = useMemo(
    () => new Map(links?.map((link) => [link._id, link])),
    [links],
  )
  const tagCounts = useMemo(() => countTags(links ?? []), [links])
  const allTags = useMemo(() => tagCounts.map(({ tag }) => tag), [tagCounts])
  // An active tag nobody carries any more (its last link was deleted)
  // stays visible, so the filter can still be seen and cleared.
  const filterTags = useMemo<TagCount[]>(
    () =>
      activeTag && !allTags.includes(activeTag)
        ? [...tagCounts, { tag: activeTag, count: 0 }]
        : tagCounts,
    [activeTag, allTags, tagCounts],
  )

  // Typing stays responsive while a large list filters behind it.
  const deferredQuery = useDeferredValue(query)
  const words = useMemo(() => searchWords(deferredQuery), [deferredQuery])
  const visible = useMemo(
    () => (links ? filterLinks(links, words, activeTag) : []),
    [links, words, activeTag],
  )
  const resetKey = `${activeTag ?? ''}\n${words.join(' ')}`

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null
  // Closes the sheet when its link is deleted, here or on another device.
  useEffect(() => {
    if (selectedId && links && !byId.has(selectedId)) setSelectedId(null)
  }, [byId, links, selectedId])

  // `/` jumps to search, as on most sites with one.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Focus goes back to the row that opened the sheet, or, when that row is
  // gone (deleted), to search; on a touch screen nowhere, so no keyboard pops up.
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const openLink = useCallback((link: Doc<'links'>) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setSelectedId(link._id)
  }, [])
  const sheetFinalFocus = useCallback(() => {
    const previous = returnFocusRef.current
    if (previous?.isConnected && previous !== document.body) return previous
    if (matchMedia('(pointer: coarse)').matches) return false
    return searchRef.current
  }, [])

  const selectTagFromRow = useCallback(
    (tag: string) => {
      onTagChange(tag)
      window.scrollTo({ top: 0 })
    },
    [onTagChange],
  )

  // A tag on an answer's row leaves the answer for that tag's links.
  const selectTagFromAnswer = useCallback(
    (tag: string) => {
      resetAsk()
      setQuery('')
      selectTagFromRow(tag)
    },
    [resetAsk, selectTagFromRow],
  )

  const submitQuestion = (text: string) => {
    const question = text.replace(/\s+/g, ' ').trim()
    if (question && askState.status !== 'asking') void ask(question)
  }

  const clearFilters = () => {
    setQuery('')
    resetAsk()
    if (activeTag) onTagChange(null)
    searchRef.current?.focus()
  }

  const loading = linksQuery.isPending || (links !== undefined && !dates)
  const empty = links !== undefined && links.length === 0
  const asking = askState.status !== 'idle'
  const filtering = words.length > 0 || activeTag !== null

  return (
    <main className="page-column fab-clearance">
      <LibraryHeader
        count={links?.length}
        actions={
          <AccountMenu
            email={user?.email ?? null}
            signingOut={signOut.isPending || signOut.isSuccess}
            onSignOut={() => signOut.mutate()}
          />
        }
      />
      <InlineError className="mb-2">
        {signOut.error && 'Couldn’t sign out. Try again.'}
      </InlineError>

      {!empty && (
        <>
          <SearchField
            ref={searchRef}
            className="mt-3"
            value={query}
            maxLength={MAX_QUESTION_LENGTH}
            busy={askState.status === 'asking'}
            disabled={loading}
            onChange={(value) => {
              setQuery(value)
              resetAsk()
            }}
            onClear={resetAsk}
            onSubmit={(value) => {
              if (isQuestion(value)) {
                submitQuestion(value)
              } else if (matchMedia('(pointer: coarse)').matches) {
                // A plain filter: put the phone keyboard away to show the results.
                searchRef.current?.blur()
              }
            }}
          />

          <TagFilterBar
            className="mt-1"
            tags={filterTags}
            active={activeTag}
            onChange={onTagChange}
          />
        </>
      )}

      {linksQuery.isError ? (
        <EmptyState
          tone="error"
          title="Couldn’t load your links."
          description="Check your connection and try again."
          action={
            <Button
              variant="outline"
              className="h-11 px-5"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          }
        />
      ) : linksQuery.data && 'error' in linksQuery.data ? (
        <EmptyState
          tone="error"
          title="You’re signed out."
          action={
            <Button
              className="h-11 px-5"
              nativeButton={false}
              render={<Link to="/sign-in" search={{ redirect: '/' }} />}
            >
              Sign in
            </Button>
          }
        />
      ) : loading || !links || !dates ? (
        <LinkListSkeleton />
      ) : empty ? (
        <EmptyState
          className="py-24"
          title="No links yet."
          description="Save the first one, or bring your saves over from Pocket."
          action={
            <div className="flex flex-col items-center gap-3">
              <Button
                className="h-11 px-5"
                nativeButton={false}
                render={<Link to="/save" />}
              >
                Add your first link
              </Button>
              <Button
                variant="ghost"
                className="h-11 px-5 text-muted-foreground"
                nativeButton={false}
                render={<Link to="/import" />}
              >
                Import from Pocket
              </Button>
            </div>
          }
        />
      ) : asking ? (
        <AskResults
          state={askState}
          byId={byId}
          dates={dates}
          onOpen={openLink}
          onTagSelect={selectTagFromAnswer}
          onDismiss={() => {
            resetAsk()
            searchRef.current?.focus()
          }}
        />
      ) : (
        <>
          {isQuestion(query) && (
            <AskPrompt question={query} onAsk={() => submitQuestion(query)} />
          )}

          {filtering && (
            <p role="status" className="sr-only">
              {visible.length === 1 ? '1 link' : `${visible.length} links`}
            </p>
          )}

          {visible.length === 0 && isQuestion(query) ? (
            // The Ask prompt above is the way forward; no big empty state.
            <p className="mt-6 text-center text-sm text-balance text-muted-foreground">
              No link has all of those words. Ask to search by meaning.
            </p>
          ) : visible.length === 0 ? (
            <NoResults
              query={words.length > 0 ? deferredQuery.trim() : ''}
              tag={activeTag}
              onClear={clearFilters}
            />
          ) : (
            <LinkList
              links={visible}
              dates={dates}
              resetKey={resetKey}
              onOpen={openLink}
              onTagSelect={selectTagFromRow}
            />
          )}
        </>
      )}

      <AddLinkButton nativeButton={false} render={<Link to="/save" />} />

      {dates && (
        <LinkDetailSheet
          link={selected}
          onClose={() => setSelectedId(null)}
          allTags={allTags}
          dates={dates}
          finalFocus={sheetFinalFocus}
        />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------

/** Shown under the filter while the box holds a question: tap to ask it. */
const AskPrompt = ({
  question,
  onAsk,
}: {
  question: string
  onAsk: () => void
}) => {
  return (
    <button
      type="button"
      onClick={onAsk}
      className="mt-3 flex h-11 w-full min-w-0 items-center gap-2 rounded-xl bg-primary/[0.06] px-4 text-left text-sm outline-hidden transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid active:bg-primary/10"
    >
      <IconSparkles className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="shrink-0 font-medium text-primary">Ask</span>
      <span className="min-w-0 truncate text-muted-foreground">
        “{question.trim()}”
      </span>
      <kbd className="ml-auto hidden shrink-0 pl-2 font-mono text-[0.6875rem] text-faint-foreground sm:inline">
        Enter
      </kbd>
    </button>
  )
}

type AskResultsProps = {
  state: Exclude<AskState, { status: 'idle' }>
  byId: ReadonlyMap<Id<'links'>, Doc<'links'>>
  dates: ClientDates
  onOpen: (link: Doc<'links'>) => void
  onTagSelect: (tag: string) => void
  onDismiss: () => void
}

/** The answer, then the links it drew on, in the order the answer gave them. */
const AskResults = ({
  state,
  byId,
  dates,
  onOpen,
  onTagSelect,
  onDismiss,
}: AskResultsProps) => {
  // Links deleted since the answer drop out.
  const sources =
    state.status === 'answered'
      ? state.linkIds.flatMap((id) => byId.get(id) ?? [])
      : []

  return (
    <div className="mt-4">
      <AnswerCard
        question={state.question}
        loading={state.status === 'asking'}
        answer={state.status === 'answered' ? state.answer : undefined}
        error={state.status === 'failed' ? state.message : undefined}
        onDismiss={state.status === 'asking' ? undefined : onDismiss}
      />
      {sources.length > 0 && (
        <section aria-label="Links in the answer">
          <MonthHeading>
            {sources.length === 1
              ? 'From 1 link'
              : `From ${sources.length} links`}
          </MonthHeading>
          {sources.map((link) => (
            <LinkItem
              key={link._id}
              link={link}
              dates={dates}
              onOpen={onOpen}
              onTagSelect={onTagSelect}
            />
          ))}
        </section>
      )}
    </div>
  )
}

const NoResults = ({
  query,
  tag,
  onClear,
}: {
  query: string
  tag: string | null
  onClear: () => void
}) => {
  const title =
    query && tag
      ? `Nothing tagged ${tag} matches “${query}”.`
      : tag
        ? `Nothing tagged ${tag}.`
        : `Nothing matches “${query}”.`

  return (
    <EmptyState
      className="py-16"
      title={<span className="wrap-anywhere">{title}</span>}
      action={
        <Button variant="outline" className="h-11 px-5" onClick={onClear}>
          {query && tag
            ? 'Clear search and tag'
            : tag
              ? 'Show all links'
              : 'Clear search'}
        </Button>
      }
    />
  )
}
