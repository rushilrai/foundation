import type { Doc } from '@convex/_generated/dataModel'
import { useRef, useState } from 'react'

import { formatSavedDateTime, type DateContext } from '@/components/lib/dates'
import type { TagPickerActions } from '@/components/TagPicker'
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { DeleteLink } from './DeleteLink'
import { LinkActions } from './LinkActions'
import { LinkSummary } from './LinkSummary'
import { LinkTagEditor } from './LinkTagEditor'

type LinkDetailSheetProps = {
  /** The live link, or null when the sheet is closed. */
  link: Doc<'links'> | null
  onClose: () => void
  /** Every tag the user has, for autocomplete. */
  allTags: readonly string[]
  dates: DateContext
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
  const tagActionsRef = useRef<TagPickerActions>(null)

  return (
    <Drawer
      open={link !== null}
      onOpenChange={(open) => {
        if (open) return
        // A tag typed but not added yet is kept, however the sheet closes.
        tagActionsRef.current?.commitPending()
        onClose()
      }}
    >
      <DrawerContent
        // Not the tag field: that would raise the keyboard on a phone.
        initialFocus={openRef}
        finalFocus={finalFocus}
      >
        {shown && (
          <>
            <DrawerHeader>
              <DrawerTitle className="text-pretty wrap-anywhere">
                {shown.title}
              </DrawerTitle>
              <DrawerDescription className="truncate font-mono text-2xs">
                {shown.domain}
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody key={shown._id}>
              <div className="flex flex-col gap-3">
                <p className="font-mono text-2xs leading-relaxed break-all text-faint-foreground select-text">
                  {shown.url}
                </p>
                {shown.description && (
                  <p className="text-sm leading-normal text-pretty wrap-anywhere text-muted-foreground">
                    {shown.description}
                  </p>
                )}
              </div>

              <LinkSummary link={shown} />

              <p className="font-mono text-2xs text-faint-foreground">
                Saved {formatSavedDateTime(shown.savedAt, dates)}
              </p>

              <LinkTagEditor
                link={shown}
                allTags={allTags}
                actionsRef={tagActionsRef}
              />

              <LinkActions link={shown} openRef={openRef} />

              <div className="-mx-3 border-t pt-2">
                <DeleteLink link={shown} onDeleted={onClose} />
              </div>
            </DrawerBody>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
