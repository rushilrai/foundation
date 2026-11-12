import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { useReturnToLibrary } from '@/modules/link/hooks'
import type { SharedPayload } from '@/modules/save/schema'
import { SaveSteps } from './SaveSteps'

type SaveSheetProps = {
  /** /save's search params while the location is /save; null closes it. */
  search: SharedPayload | null
}

const isTouch = () => matchMedia('(pointer: coarse)').matches

// How every link gets in: the share target, Home's Add link button, a
// pasted link, or any tool that opens /save?url=…. It has its own URL,
// because a share often opens the app straight onto it, and shows as a sheet
// over the library: from the bottom on a phone, a centred panel from `sm` up.
export const SaveSheet = ({ search }: SaveSheetProps) => {
  const router = useRouter()
  const { returnToLibrary } = useReturnToLibrary()

  // Closing hides the sheet at once; the location follows.
  const [closing, setClosing] = useState(false)
  if (closing && !search) setClosing(false)
  const open = search !== null && !closing

  // Each opening starts afresh, and the last one stays on screen while the
  // sheet animates closed.
  const [shown, setShown] = useState(search)
  if (search && search !== shown) setShown(search)
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((count) => count + 1)
  }

  // A save on its way: a stray tap on the backdrop or a swipe must not drop
  // it, so the sheet stays until it is done.
  const [saving, setSaving] = useState(false)

  const titleRef = useRef<HTMLHeadingElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Once per closing: history.back() lands a moment later.
  const leavingRef = useRef(false)
  useEffect(() => {
    if (!search) leavingRef.current = false
  }, [search])

  const close = () => {
    // Already left, e.g. by Back while a save was on its way.
    if (leavingRef.current || router.state.location.pathname !== '/save') {
      return
    }
    leavingRef.current = true
    setClosing(true)
    returnToLibrary()
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next, details) => {
        if (next) return
        if (saving) {
          details.cancel()
          return
        }
        close()
      }}
      onOpenChangeComplete={(opened) => {
        // On a phone the link field takes focus only once the sheet is up,
        // so the keyboard does not rise into the opening animation.
        if (opened && isTouch()) urlInputRef.current?.focus()
      }}
    >
      <DrawerContent
        // With a link, the sheet takes its full height, so a preview
        // arriving or a tag added or removed never moves its top edge (and
        // Close) under the finger.
        className="has-[[data-slot=save-form]]:h-[calc(100dvh-2.5rem)] sm:has-[[data-slot=save-form]]:h-[min(85dvh,48rem)]"
        initialFocus={() =>
          isTouch()
            ? titleRef.current
            : (urlInputRef.current ?? tagInputRef.current)
        }
      >
        <DrawerHeader>
          <DrawerTitle
            ref={titleRef}
            // Focusable from script only, so focus has somewhere to go when
            // the part of the sheet that held it is replaced.
            tabIndex={-1}
            className="outline-hidden"
          >
            Save a link
          </DrawerTitle>
        </DrawerHeader>

        {shown && (
          <SaveSteps
            key={session}
            search={shown}
            headingRef={titleRef}
            urlInputRef={urlInputRef}
            tagInputRef={tagInputRef}
            onSaved={close}
            onBusyChange={setSaving}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}
