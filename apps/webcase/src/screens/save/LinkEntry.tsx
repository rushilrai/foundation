import { MAX_URL_LENGTH } from '@shared/limits'
import { IconClipboard } from '@tabler/icons-react'
import { useId, useRef, useState } from 'react'

import { InlineError } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MESSAGES } from '@/modules/link/errors'
import { findUrl } from '@/modules/save/utils'

type LinkEntryProps = {
  /** Starts the field with this, e.g. the link being changed. */
  initial: string
  /** What a share sent when it held no link. */
  sharedText: string | null
  /** Called with the normalised href. */
  onSubmit: (href: string) => void
  /** The link field, so the sheet can focus it once it has opened. */
  inputRef?: React.Ref<HTMLInputElement>
  /** Focus the field on mount, e.g. after Change. */
  autoFocus?: boolean
}

// No link yet: a field, and one tap to take the link from the clipboard,
// which is how links arrive on an iPhone (no share target for web apps).
export const LinkEntry = ({
  initial,
  sharedText,
  onSubmit,
  inputRef: forwardedRef,
  autoFocus = false,
}: LinkEntryProps) => {
  const id = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const setInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element
    if (typeof forwardedRef === 'function') forwardedRef(element)
    else if (forwardedRef) forwardedRef.current = element
  }

  const focusField = () => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  const submit = () => {
    const href = findUrl(value)
    if (href) {
      onSubmit(href)
    } else {
      setError(value.trim() ? MESSAGES.INVALID_URL : 'Enter a link.')
      focusField()
    }
  }

  // Needs the tap itself: browsers only allow reading the clipboard from a
  // user gesture, and iOS then shows its own small Paste button.
  const paste = async () => {
    setError(null)
    setNotice(null)
    setReading(true)
    try {
      const text = await navigator.clipboard.readText()
      const href = findUrl(text)
      if (href) {
        onSubmit(href)
        return
      }
      setNotice(
        text.trim()
          ? 'There’s no link on your clipboard. Paste or type one here.'
          : 'Your clipboard is empty. Copy a link first, or type one here.',
      )
    } catch {
      setNotice('Couldn’t read the clipboard. Paste the link here instead.')
    } finally {
      setReading(false)
    }
    focusField()
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <Field data-invalid={Boolean(error)} className="gap-1">
        <FieldLabel htmlFor={id} className="text-muted-foreground">
          Link
        </FieldLabel>
        <Input
          ref={setInputRef}
          id={id}
          name="url"
          type="url"
          inputMode="url"
          enterKeyHint="go"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          // The sheet focuses it when it opens (on a phone once it is up).
          autoFocus={autoFocus}
          maxLength={MAX_URL_LENGTH}
          placeholder="https://"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || notice ? `${id}-message` : undefined}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          onPaste={(event) => {
            // A pasted link goes straight on; anything else lands in the field.
            const href = findUrl(event.clipboardData.getData('text'))
            if (href) {
              event.preventDefault()
              onSubmit(href)
            }
          }}
        />
        {error ? (
          <InlineError id={`${id}-message`} className="mt-1">
            {error}
          </InlineError>
        ) : (
          notice && (
            <p
              id={`${id}-message`}
              role="status"
              className="mt-1 text-sm text-muted-foreground"
            >
              {notice}
            </p>
          )
        )}
      </Field>

      <div className="flex gap-3">
        <Button
          type="button"
          size="lg"
          className="h-12 flex-1 text-md"
          disabled={reading}
          onClick={() => void paste()}
        >
          <IconClipboard data-icon="inline-start" aria-hidden />
          Paste link
        </Button>
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="h-12 flex-1 text-md"
        >
          Continue
        </Button>
      </div>

      {sharedText && (
        <div className="rounded-xl bg-muted px-4 py-3">
          <p className="text-xs text-muted-foreground">
            There was no link in what you shared:
          </p>
          <p className="mt-1 line-clamp-6 text-sm wrap-anywhere whitespace-pre-line text-foreground">
            {sharedText}
          </p>
        </div>
      )}
    </form>
  )
}
