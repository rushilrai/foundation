import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { useReturnToLibrary } from '@/modules/link/hooks'
import type { SharedPayload } from '@/modules/save/schema'
import { findSharedUrl, findUrl } from '@/modules/save/utils'
import { LinkEntry } from './LinkEntry'
import { SaveForm } from './SaveForm'

type SaveScreenProps = {
  search: SharedPayload
}

// How every link gets in: the share target, Home's Add link button, a
// pasted link, or any tool that opens /save?url=…. A full page rather than
// a sheet, because a share often opens the app straight onto it.
export const SaveScreen = ({ search }: SaveScreenProps) => {
  const navigate = useNavigate({ from: '/save' })
  const { onLibraryLinkClick } = useReturnToLibrary()
  // A link entered or cleared on this page. It applies at once, while the
  // search params follow (a navigation re-runs the root's auth check, a
  // server round trip), so reloading keeps the link.
  const [entered, setEntered] = useState<{ url: string | null } | null>(null)
  const url = entered ? entered.url : findSharedUrl(search)
  // The link being replaced, so Change starts from it.
  const [draft, setDraft] = useState('')

  const headingRef = useRef<HTMLHeadingElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const focusFormRef = useRef(false)

  // The link field that had focus is gone once a link is entered. Focus
  // goes on to the tags with a keyboard and mouse; on a touch screen to the
  // heading, so the on-screen keyboard does not rise by itself.
  useEffect(() => {
    if (!url || !focusFormRef.current) return
    focusFormRef.current = false
    if (matchMedia('(pointer: coarse)').matches) headingRef.current?.focus()
    else tagInputRef.current?.focus()
  }, [url])

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
    focusFormRef.current = next !== null
    setEntered({ url: next })
    // `state: true` keeps the history state, which says whether the
    // library opened this page.
    void navigate({
      search: next ? { url: next } : {},
      replace: true,
      state: true,
    })
  }

  return (
    <main className="page-column flex min-h-dvh flex-col">
      <PageHeader
        title="Save a link"
        headingRef={headingRef}
        back={<Link to="/" onClick={onLibraryLinkClick} />}
      />

      {url ? (
        <SaveForm
          key={url}
          url={url}
          sharedTitle={sharedTitle}
          tagInputRef={tagInputRef}
          onChangeLink={() => {
            setDraft(url)
            enter(null)
          }}
        />
      ) : (
        <LinkEntry
          initial={draft}
          sharedText={sharedText || null}
          onSubmit={enter}
        />
      )}
    </main>
  )
}
