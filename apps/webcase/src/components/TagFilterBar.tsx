import type { TagCount } from '@shared/tags'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/components/lib/utils'

type TagFilterBarProps = {
  /** Most used first, e.g. from countTags in modules/link/utils.ts. */
  tags: readonly TagCount[]
  /** The selected tag, or null for all links. */
  active: string | null
  onChange: (tag: string | null) => void
  allLabel?: string
  label?: string
  className?: string
}

// Space kept between a scrolled-to item and the bar's edges.
const GUTTER = 24

// Scrolls the bar sideways (never the page) until `item` is in view.
const revealItem = (
  scroller: HTMLElement,
  item: HTMLElement,
  behavior: ScrollBehavior,
) => {
  const start = item.offsetLeft - scroller.offsetLeft
  const end = start + item.offsetWidth
  if (start < scroller.scrollLeft + GUTTER) {
    scroller.scrollTo({ left: start - GUTTER, behavior })
  } else if (end > scroller.scrollLeft + scroller.clientWidth - GUTTER) {
    scroller.scrollTo({
      left: end - scroller.clientWidth + GUTTER * 2,
      behavior,
    })
  }
}

/**
 * One scrollable line of tag filters: `all  places¹¹⁶  dev³⁴ …`.
 * The active item is cobalt and underlined, and is scrolled into view when it
 * changes and when the tags arrive. The bar is a single tab stop (the
 * active item); the arrow keys, Home and End move along it.
 */
export const TagFilterBar = ({
  tags,
  active,
  onChange,
  allLabel = 'all',
  label = 'Filter by tag',
  className,
}: TagFilterBarProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = useState(true)
  // The item that holds the tab stop: the active one until the arrow keys
  // move it. Index 0 is "all".
  const [focusIndex, setFocusIndex] = useState<number | null>(null)

  const items: Array<{ tag: string | null; count?: number }> = [
    { tag: null },
    ...tags,
  ]
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.tag === active),
  )
  const tabIndex =
    focusIndex !== null && focusIndex < items.length ? focusIndex : activeIndex

  // A new filter (here, from a row's tag, or Back) moves the tab stop to it.
  const [lastActive, setLastActive] = useState(active)
  if (lastActive !== active) {
    setLastActive(active)
    setFocusIndex(null)
  }

  const updateAtEnd = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    setAtEnd(
      scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 4,
    )
  }

  useEffect(() => {
    updateAtEnd()
    const scroller = scrollerRef.current
    if (!scroller) return
    const observer = new ResizeObserver(updateAtEnd)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [tags.length])

  // Bring the active filter into view: smoothly when the user picks one,
  // at once when the tags arrive (a reload or cold open of `/?tag=…`).
  const shownActiveRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const scroller = scrollerRef.current
    const item = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!scroller || !item) return
    const behavior =
      shownActiveRef.current !== undefined && shownActiveRef.current !== active
        ? 'smooth'
        : 'instant'
    shownActiveRef.current = active
    revealItem(scroller, item, behavior)
  }, [active, tags])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const buttons = [...scroller.querySelectorAll<HTMLElement>('button')]
    // From the focused item, which is not the tab stop right after
    // pressing the active filter off.
    const focused = buttons.indexOf(document.activeElement as HTMLElement)
    const from = focused >= 0 ? focused : tabIndex
    const last = buttons.length - 1
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? Math.min(from + 1, last)
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? Math.max(from - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    setFocusIndex(next)
    buttons[next].focus({ preventScroll: true })
    revealItem(scroller, buttons[next], 'smooth')
  }

  return (
    <div
      ref={scrollerRef}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      onScroll={updateAtEnd}
      onKeyDown={onKeyDown}
      className={cn(
        '-mx-4 no-scrollbar flex items-stretch gap-x-3 overflow-x-auto overscroll-x-contain px-3',
        !atEnd && 'fade-x-end',
        className,
      )}
    >
      {items.map(({ tag, count }, index) => (
        <FilterItem
          key={tag ?? ''}
          name={tag ?? allLabel}
          count={count}
          pressed={active === tag}
          tabIndex={index === tabIndex ? 0 : -1}
          onFocus={() => setFocusIndex(index)}
          onPress={() => onChange(tag === null || active === tag ? null : tag)}
        />
      ))}
    </div>
  )
}

type FilterItemProps = {
  name: string
  count?: number
  pressed: boolean
  tabIndex: number
  onFocus: () => void
  onPress: () => void
}

const FilterItem = ({
  name,
  count,
  pressed,
  tabIndex,
  onFocus,
  onPress,
}: FilterItemProps) => {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={onPress}
      className={cn(
        'group flex h-11 shrink-0 items-center rounded-sm px-1 text-sm whitespace-nowrap lowercase outline-hidden transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring focus-visible:outline-solid',
        pressed
          ? 'font-semibold text-primary'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {/* The bold copy reserves the semibold width, so items do not shift when pressed. */}
      <span
        data-text={name}
        className={cn(
          'inline-grid underline-offset-[7px] after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-text)]',
          pressed && 'underline decoration-primary decoration-[1.5px]',
        )}
      >
        {name}
      </span>
      {count !== undefined && (
        <sup
          className={cn(
            'ml-px font-mono text-[0.625rem] font-normal tabular-nums',
            pressed ? 'text-primary' : 'text-faint-foreground',
          )}
        >
          <span className="sr-only">, </span>
          {count}
          <span className="sr-only"> links</span>
        </sup>
      )}
    </button>
  )
}
