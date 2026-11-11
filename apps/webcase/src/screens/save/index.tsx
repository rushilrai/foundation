import { IconChevronLeft } from '@tabler/icons-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  findSharedUrl,
  findUrl,
  type SharedPayload,
} from '@/modules/save/utils'
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
  // A link entered or cleared on this page. It applies at once, while the
  // search params follow (a navigation re-runs the root's auth check, a
  // server round trip), so reloading keeps the link.
  const [entered, setEntered] = useState<{ url: string | null } | null>(null)
  const url = entered ? entered.url : findSharedUrl(search)
  // The link being replaced, so Change starts from it.
  const [draft, setDraft] = useState('')

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
    setEntered({ url: next })
    void navigate({ search: next ? { url: next } : {}, replace: true })
  }

  return (
    <main className="page-column flex min-h-dvh flex-col">
      <header className="flex h-14 items-center">
        <Button
          variant="ghost"
          className="-ml-3 h-11 px-3 text-muted-foreground"
          nativeButton={false}
          render={<Link to="/" />}
        >
          <IconChevronLeft data-icon="inline-start" aria-hidden />
          Library
        </Button>
      </header>

      <h1 className="mt-2 font-serif text-2xl font-medium">Save a link</h1>

      {url ? (
        <SaveForm
          key={url}
          url={url}
          sharedTitle={sharedTitle}
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
