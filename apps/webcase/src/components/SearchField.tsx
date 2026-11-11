import { IconSparkles, IconX } from '@tabler/icons-react'
import { useId, useRef } from 'react'

import { cn } from '@/components/lib/utils'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  /** Enter or the keyboard's search key. */
  onSubmit?: (value: string) => void
  /** Called after the × button or Escape empties the field. */
  onClear?: () => void
  /** Shows a running underline and `busyLabel`, e.g. while an answer is on its way. */
  busy?: boolean
  busyLabel?: string
  placeholder?: string
  /** Accessible name; the field has no visible label. */
  label?: string
  autoFocus?: boolean
  className?: string
}

/** The library's search: a full-width underline, no box. */
export const SearchField = ({
  value,
  onChange,
  onSubmit,
  onClear,
  busy = false,
  busyLabel = 'asking…',
  placeholder = 'Search or ask…',
  label = 'Search your links',
  autoFocus,
  className,
}: SearchFieldProps) => {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const clear = () => {
    onChange('')
    onClear?.()
    inputRef.current?.focus()
  }

  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.(value)
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        aria-busy={busy || undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault()
            clear()
          }
        }}
        className={cn(
          'h-12 w-full min-w-0 appearance-none rounded-none border-0 border-b-[1.5px] border-foreground bg-transparent px-0 text-[1.0625rem] text-foreground outline-hidden transition-colors placeholder:font-serif placeholder:text-lg placeholder:text-faint-foreground placeholder:italic focus:border-primary [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
          value ? 'pr-11' : 'pr-0',
          busy && 'pr-28',
        )}
      />

      {busy && (
        <>
          <span
            role="status"
            className={cn(
              'pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-1 font-mono text-[0.6875rem] text-primary',
              value ? 'right-11' : 'right-0',
            )}
          >
            <IconSparkles className="size-3.5" aria-hidden />
            {busyLabel}
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[1.5px] overflow-hidden"
          >
            <span className="block h-full w-1/3 animate-indeterminate bg-primary motion-reduce:animate-none" />
          </span>
        </>
      )}

      {value && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-end rounded-sm text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
        >
          <IconX className="size-4.5" aria-hidden />
          <span className="sr-only">Clear search</span>
        </button>
      )}
    </form>
  )
}
