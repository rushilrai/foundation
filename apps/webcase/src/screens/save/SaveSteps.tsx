import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { DrawerBody } from '@/components/ui/drawer'
import { isTouchScreen } from '@/lib/touch'
import type { SharedPayload } from '@/modules/save/schema'
import { findSharedUrl, findUrl } from '@/modules/save/utils'
import { LinkEntry } from './LinkEntry'
import { SaveForm } from './SaveForm'

type SaveStepsProps = {
  search: SharedPayload
  /** The sheet's title, where focus goes on a touch screen. */
  headingRef: React.RefObject<HTMLHeadingElement | null>
  urlInputRef: React.RefObject<HTMLInputElement | null>
  tagInputRef: React.RefObject<HTMLInputElement | null>
  onSaved: () => void
  onBusyChange: (busy: boolean) => void
}

// The sheet's content: the link field until there is a link, then the
// preview, the tags and Save.
export const SaveSteps = ({
  search,
  headingRef,
  urlInputRef,
  tagInputRef,
  onSaved,
  onBusyChange,
}: SaveStepsProps) => {
  const navigate = useNavigate({ from: '/save' })
  // A link entered or cleared in the sheet. It applies at once, while the
  // search params follow (a navigation re-runs the root's auth check, a
  // server round trip), so reloading keeps the link.
  const [entered, setEntered] = useState<{ url: string | null } | null>(null)
  const url = entered ? entered.url : findSharedUrl(search)
  // The link being replaced, so Change starts from it.
  const [draft, setDraft] = useState('')
  const moveFocusRef = useRef(false)

  // Entering a link or Change replaces the part of the sheet that had
  // focus. Focus goes on to the next field with a keyboard and mouse (the
  // tags, or the link after Change); on a touch screen to the title, so the
  // on-screen keyboard does not rise by itself. The sheet stays scrolled to
  // the top, where the link and "Already in your library" are.
  useEffect(() => {
    if (!moveFocusRef.current) return
    moveFocusRef.current = false
    const target = isTouchScreen()
      ? headingRef.current
      : url
        ? tagInputRef.current
        : urlInputRef.current
    target?.focus({ preventScroll: true })
  }, [url, headingRef, tagInputRef, urlInputRef])

  // A shared title that is words, not a link: the page's name, which beats
  // host and path when the page itself can't be read.
  const title = search.title?.replace(/\s+/g, ' ').trim()
  const sharedTitle = !entered && url && title && !findUrl(title) ? title : null

  // What was shared when it held no link, so the visitor can see why.
  const sharedText =
    url || entered
      ? null
      : [search.title, search.text]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join('\n')

  const enter = (next: string | null) => {
    moveFocusRef.current = true
    setEntered({ url: next })
    // `state: true` keeps the history state, which says whether the
    // library opened the sheet; the library behind keeps its scroll.
    void navigate({
      search: (prev) => ({ tag: prev.tag, url: next ?? undefined }),
      replace: true,
      state: true,
      resetScroll: false,
    })
  }

  return url ? (
    <SaveForm
      key={url}
      url={url}
      sharedTitle={sharedTitle}
      tagInputRef={tagInputRef}
      onChangeLink={() => {
        setDraft(url)
        enter(null)
      }}
      onSaved={onSaved}
      onBusyChange={onBusyChange}
    />
  ) : (
    <DrawerBody>
      <LinkEntry
        inputRef={urlInputRef}
        initial={draft}
        sharedText={sharedText || null}
        onSubmit={enter}
      />
    </DrawerBody>
  )
}
