import { MAX_TAGS, normalizeTag, normalizeTags } from '@shared/tags'
import { IconPlus, IconSparkles, IconX } from '@tabler/icons-react'
import { useId, useImperativeHandle, useMemo, useRef, useState } from 'react'

import { InlineError } from '@/components/EmptyState'
import { cn } from '@/components/lib/utils'
import { SectionLabel } from '@/components/SectionLabel'
import { TagDot } from '@/components/Tag'
import { Input } from '@/components/ui/input'

const MAX_MATCHES = 6

type TagPickerProps = {
  /** The chosen tags, already normalised (shared/tags.ts). */
  value: readonly string[]
  onChange: (tags: string[]) => void
  /** Tags proposed for this link (tap to add). Compared after normalising. */
  suggestions?: readonly string[]
  /** Every tag the user already has, for autocomplete. Compared after normalising. */
  allTags?: readonly string[]
  suggestionsLoading?: boolean
  /** Turns off adding and removing, e.g. while the link saves. */
  disabled?: boolean
  /** Shown under the field, which is then marked invalid. */
  error?: React.ReactNode
  /** The text input, e.g. to focus it when the sheet opens. */
  ref?: React.Ref<HTMLInputElement>
  /** For a form that submits or closes while a tag is still being typed. */
  actionsRef?: React.Ref<TagPickerActions>
  label?: string
  placeholder?: string
  className?: string
}

const uniqueNormalized = (tags: readonly string[]) => [
  ...new Set(tags.map(normalizeTag).filter(Boolean)),
]

type Option = { tag: string; isNew: boolean }

// For the option, suggestion and remove buttons: a tap on one keeps focus
// in the field, so the phone keyboard stays up between taps.
const keepFieldFocus = (event: React.PointerEvent | React.MouseEvent) =>
  event.preventDefault()

export type TagPickerActions = {
  /**
   * Adds the tag still being typed, if any, and returns the tags with it,
   * so a submit right after typing includes it.
   */
  commitPending: () => string[]
}

/**
 * Chooses a link's tags: removable chips, tap-to-add suggestions, and a field
 * that adds on Enter or comma and autocompletes from the user's tags.
 */
export const TagPicker = ({
  value,
  onChange,
  suggestions = [],
  allTags = [],
  suggestionsLoading = false,
  disabled = false,
  error,
  ref,
  actionsRef,
  label = 'Tags',
  placeholder = 'Add a tag…',
  className,
}: TagPickerProps) => {
  const id = useId()
  const inputId = `${id}-input`
  const listId = `${id}-options`
  const errorId = `${id}-error`
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)

  const full = value.length >= MAX_TAGS
  const normalizedQuery = full ? '' : normalizeTag(query)
  const knownTags = useMemo(() => uniqueNormalized(allTags), [allTags])

  const setInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element
    if (typeof ref === 'function') ref(element)
    else if (ref) ref.current = element
  }

  const add = (raw: readonly string[]): string[] => {
    const next = normalizeTags([...value, ...raw])
    if (next.length !== value.length) onChange(next)
    return next
  }

  const remove = (tag: string) => onChange(value.filter((item) => item !== tag))

  // Existing tags that start with the query come first, then ones that contain it.
  const options = useMemo<Option[]>(() => {
    if (!normalizedQuery) return []
    const available = knownTags.filter((tag) => !value.includes(tag))
    const starts = available.filter((tag) => tag.startsWith(normalizedQuery))
    const contains = available.filter(
      (tag) =>
        !tag.startsWith(normalizedQuery) && tag.includes(normalizedQuery),
    )
    const matches = [...starts, ...contains]
      .slice(0, MAX_MATCHES)
      .map((tag) => ({ tag, isNew: false }))
    const known =
      knownTags.includes(normalizedQuery) || value.includes(normalizedQuery)
    return known ? matches : [{ tag: normalizedQuery, isNew: true }, ...matches]
  }, [knownTags, normalizedQuery, value])

  // Open while there is text, focused or not: typed text stays when the
  // field is left, and closing the list on blur would move everything
  // around it mid-tap (in a bottom sheet, the Close button above it).
  const listOpen = !disabled && options.length > 0
  const activeIndex = Math.min(highlighted, options.length - 1)
  const pendingSuggestions = full
    ? []
    : uniqueNormalized(suggestions).filter((tag) => !value.includes(tag))

  const commit = (tag: string) => {
    const next = add([tag])
    setQuery('')
    setHighlighted(0)
    return next
  }

  // Leaving the field (a tap elsewhere, switching apps) keeps the text as
  // text. The form adds it when it is done: Save, or closing the sheet,
  // calls this. Escape clears it.
  const commitPending = () =>
    normalizedQuery && !disabled ? commit(normalizedQuery) : [...value]

  useImperativeHandle(actionsRef, () => ({ commitPending }))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <SectionLabel as="label" htmlFor={inputId}>
        {label}
      </SectionLabel>

      {value.length > 0 && (
        <ul aria-label="Chosen tags" className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted pr-1 pl-3 text-sm text-foreground"
            >
              <TagDot name={tag} />
              {tag}
              <button
                type="button"
                disabled={disabled}
                onPointerDown={keepFieldFocus}
                onMouseDown={keepFieldFocus}
                onClick={(event) => {
                  // Reached by keyboard: the button is about to go, so focus
                  // moves to the field rather than the page.
                  const hadFocus =
                    event.currentTarget === document.activeElement
                  remove(tag)
                  if (hadFocus) inputRef.current?.focus()
                }}
                className="relative flex size-7 items-center justify-center rounded-full text-muted-foreground outline-hidden transition-colors after:absolute after:-inset-2 hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid disabled:pointer-events-none disabled:opacity-50"
              >
                <IconX className="size-3.5" aria-hidden />
                <span className="sr-only">Remove {tag}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Input
          ref={setInputRef}
          id={inputId}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            listOpen ? `${listId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={full ? `${MAX_TAGS} tags at most` : placeholder}
          value={full ? '' : query}
          onChange={(event) => {
            // Mobile keyboards often send the comma only as input, not as a key.
            const parts = event.target.value.split(',')
            if (parts.length > 1) {
              add(parts.slice(0, -1))
              setQuery((parts.at(-1) ?? '').trimStart())
            } else {
              setQuery(event.target.value.trimStart())
            }
            setHighlighted(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // Never submit the surrounding form from here.
              event.preventDefault()
              const option = listOpen ? options[activeIndex] : undefined
              if (option) commit(option.tag)
              else if (normalizedQuery) commit(normalizedQuery)
            } else if (event.key === 'Escape' && (query || listOpen)) {
              // Clears the field and stops there: the sheet or page around
              // it stays open.
              event.preventDefault()
              event.stopPropagation()
              setQuery('')
              setHighlighted(0)
            } else if (event.key === ',') {
              event.preventDefault()
              if (normalizedQuery) commit(normalizedQuery)
            } else if (
              event.key === 'Backspace' &&
              // Holding Backspace to clear the text must not go on to eat the chips.
              !event.repeat &&
              !query &&
              value.length
            ) {
              remove(value[value.length - 1])
            } else if (event.key === 'ArrowDown' && listOpen) {
              event.preventDefault()
              setHighlighted((activeIndex + 1) % options.length)
            } else if (event.key === 'ArrowUp' && listOpen) {
              event.preventDefault()
              setHighlighted(
                (activeIndex - 1 + options.length) % options.length,
              )
            }
          }}
        />

        <ul
          id={listId}
          role="listbox"
          aria-label="Matching tags"
          hidden={!listOpen}
          className="mt-1 flex flex-col py-1"
        >
          {options.map((option, index) => (
            <li
              key={`${option.isNew}-${option.tag}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onPointerDown={keepFieldFocus}
              onMouseDown={keepFieldFocus}
              onClick={() => commit(option.tag)}
              onMouseEnter={() => setHighlighted(index)}
              className={cn(
                'flex h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm',
                index === activeIndex && 'bg-muted',
              )}
            >
              {option.isNew ? (
                <>
                  <IconPlus
                    className="size-3.5 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="text-muted-foreground">Add</span>
                  <span className="truncate font-medium text-foreground">
                    {option.tag}
                  </span>
                </>
              ) : (
                <>
                  <TagDot name={option.tag} className="size-2" />
                  <Highlight text={option.tag} query={normalizedQuery} />
                </>
              )}
            </li>
          ))}
        </ul>

        <InlineError id={errorId} className="mt-1.5">
          {error}
        </InlineError>
      </div>

      {(suggestionsLoading || pendingSuggestions.length > 0) && (
        <div className="flex flex-col gap-2.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <IconSparkles className="size-3.5 text-primary" aria-hidden />
            Suggested
          </p>
          {suggestionsLoading ? (
            <div className="flex flex-wrap gap-2" role="status">
              <span className="sr-only">Finding tags for this link…</span>
              {['w-16', 'w-20', 'w-12'].map((width) => (
                <span
                  key={width}
                  aria-hidden
                  className={cn(
                    'h-9 animate-pulse rounded-full border border-dashed border-foreground/20 motion-reduce:animate-none',
                    width,
                  )}
                />
              ))}
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2" aria-label="Suggested tags">
              {pendingSuggestions.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    disabled={disabled}
                    onPointerDown={keepFieldFocus}
                    onMouseDown={keepFieldFocus}
                    // The suggestion replaces whatever was half typed.
                    onClick={() => commit(tag)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-foreground/25 pr-3.5 pl-2.5 text-sm text-muted-foreground outline-hidden transition-colors hover:border-primary/60 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid active:bg-muted disabled:pointer-events-none disabled:opacity-50"
                  >
                    <IconPlus className="size-3.5" aria-hidden />
                    <TagDot name={tag} />
                    <span>
                      <span className="sr-only">Add </span>
                      {tag}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

const Highlight = ({ text, query }: { text: string; query: string }) => {
  const start = text.indexOf(query)
  if (!query || start < 0) return <span className="truncate">{text}</span>

  return (
    <span className="truncate text-muted-foreground">
      {text.slice(0, start)}
      <span className="font-semibold text-foreground">
        {text.slice(start, start + query.length)}
      </span>
      {text.slice(start + query.length)}
    </span>
  )
}
