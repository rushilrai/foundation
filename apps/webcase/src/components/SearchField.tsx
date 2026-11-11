import { IconSparkles, IconX } from '@tabler/icons-react'
import { useId, useRef } from 'react'

import { cn } from '@/components/lib/utils'

type SearchFieldProps = Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'onSubmit' | 'type' | 'className' | 'ref'
> & {
  value: string
  onChange: (value: string) => void
  /** Enter or the keyboard's search key. */
  onSubmit?: (value: string) => void
  /** Called after the × button or Escape empties the field. */
  onClear?: () => void
  /** Shows a running underline and `busyLabel`, e.g. while an answer is on its way. */
  busy?: boolean
  busyLabel?: string
  /** Accessible name; the field has no visible label. */
  label?: string
  /** The input itself. */
  ref?: React.Ref<HTMLInputElement>
  /** On the surrounding form. */
  className?: string
}

/**
 * The library's search: a full-width underline, no box. Other input props
 * (`autoFocus`, `maxLength`, `name`, `onFocus`…) pass through to the input.
 */
export const SearchField = ({
  value,
  onChange,
  onSubmit,
  onClear,
  busy = false,
  busyLabel = 'asking…',
  placeholder = 'Search or ask…',
  label = 'Search your links',
  disabled,
  ref,
  className,
  onKeyDown,
  ...inputProps
}: SearchFieldProps) => {
  const id = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)

  const setInputRef = (element: HTMLInputElement | null) => {
    inputRef.current = element
    if (typeof ref === 'function') ref(element)
    else if (ref) ref.current = element
  }

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
        if (!disabled) onSubmit?.(value)
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        {...inputProps}
        ref={setInputRef}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        aria-busy={busy || undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.key === 'Escape' && value && !event.defaultPrevented) {
            event.preventDefault()
            clear()
          }
        }}
        className={cn(
          // Focus turns the underline cobalt and doubles it (an inset shadow, so nothing shifts).
          'h-12 w-full min-w-0 appearance-none rounded-none border-0 border-b-[1.5px] border-foreground bg-transparent px-0 text-lede text-foreground outline-hidden transition-[border-color,box-shadow] placeholder:font-serif placeholder:text-lg placeholder:text-faint-foreground placeholder:italic focus:border-primary focus:shadow-[inset_0_-1.5px_0_0_var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
          value ? 'pr-11' : 'pr-0',
          busy && 'pr-28',
        )}
      />

      {busy && (
        <>
          <span
            role="status"
            className={cn(
              'pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-1 font-mono text-2xs text-primary',
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

      {value && !disabled && (
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
