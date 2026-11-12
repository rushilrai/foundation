import type { Doc, Id } from '@convex/_generated/dataModel'
import { MAX_QUESTION_LENGTH } from '@shared/limits'
import { normalizeTag, type TagCount } from '@shared/tags'
import { Link } from '@tanstack/react-router'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { AddLinkButton } from '@/components/AddLinkButton'
import { EmptyState, InlineError } from '@/components/EmptyState'
import { LibraryHeader } from '@/components/LibraryHeader'
import { SearchField } from '@/components/SearchField'
import { TagFilterBar } from '@/components/TagFilterBar'
import { Button } from '@/components/ui/button'
import { useClientDates } from '@/hooks/useClientDates'
import { useSignOutMutation } from '@/modules/auth/mutations'
import { useCurrentUser } from '@/modules/auth/queries'
import { LinkDetailSheet } from '@/modules/link/components/LinkDetailSheet'
import { LinkList, LinkListSkeleton } from '@/modules/link/components/LinkList'
import { MESSAGES } from '@/modules/link/errors'
import { FROM_LIBRARY } from '@/modules/link/hooks'
import { useAsk } from '@/modules/link/mutations'
import { useLibrary } from '@/modules/link/queries'
import { filterLinks, isQuestion, searchWords } from '@/modules/link/search'
import { AccountMenu } from './AccountMenu'
import { AskPrompt } from './AskPrompt'
import { AskResults } from './AskResults'
import { useSearchShortcut } from './hooks'
import { NoResults } from './NoResults'

type HomeScreenProps = {
  /** The tag filter from the URL, or undefined for all links. */
  tag: string | undefined
  onTagChange: (tag: string | null) => void
}

export const HomeScreen = ({ tag: tagParam, onTagChange }: HomeScreenProps) => {
  const user = useCurrentUser()
  const signOut = useSignOutMutation()
  const library = useLibrary()
  const dates = useClientDates()

  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const { state: askState, ask, reset: resetAsk } = useAsk()
  const [selectedId, setSelectedId] = useState<Id<'links'> | null>(null)

  const activeTag = (tagParam && normalizeTag(tagParam)) || null

  const { links, tagCounts, tags: allTags } = library

  const byId = useMemo(
    () => new Map(links?.map((link) => [link._id, link])),
    [links],
  )
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
  // A cleared box applies at once, so a tag picked while an answer shows
  // never flashes "nothing matches" for the old question.
  const lagging = useDeferredValue(query)
  const deferredQuery = query.trim() ? lagging : ''
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

  useSearchShortcut(searchRef)

  // An answer covers the whole library, so asking clears the tag filter
  // (below), and picking a tag afterwards (in the bar, on a row, or with
  // Back and Forward) leaves the answer for that tag's links. Before paint,
  // so the old answer never shows under the new tag.
  const asking = askState.status !== 'idle'
  const shownTagRef = useRef(activeTag)
  useLayoutEffect(() => {
    if (shownTagRef.current === activeTag) return
    shownTagRef.current = activeTag
    if (activeTag !== null && asking) {
      resetAsk()
      setQuery('')
    }
  }, [activeTag, asking, resetAsk])

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
    if (!question || askState.status === 'asking') return
    if (activeTag) onTagChange(null)
    ask(question)
  }

  const clearFilters = () => {
    setQuery('')
    resetAsk()
    if (activeTag) onTagChange(null)
    searchRef.current?.focus()
  }

  // The save sheet opens over the library, which keeps its tag and scroll.
  const addLink = (
    <Link
      to="/save"
      search={{ tag: tagParam }}
      state={FROM_LIBRARY}
      resetScroll={false}
    />
  )

  const loading =
    library.status === 'loading' || (links !== undefined && !dates)
  const empty = links !== undefined && links.length === 0
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

      {library.status === 'error' ? (
        <EmptyState
          tone="error"
          title="Couldn’t load your links."
          description={MESSAGES.NETWORK}
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
      ) : library.status === 'signedOut' ? (
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
                render={addLink}
              >
                Add your first link
              </Button>
              <Button
                variant="ghost"
                className="h-11 px-5 text-muted-foreground"
                nativeButton={false}
                render={<Link to="/import" state={FROM_LIBRARY} />}
              >
                Import from Pocket
              </Button>
            </div>
          }
        />
      ) : askState.status !== 'idle' ? (
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

      <AddLinkButton nativeButton={false} render={addLink} />

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
