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

/**
 * One scrollable line of tag filters: `all  places¹¹⁶  dev³⁴ …`.
 * The active item is cobalt and underlined, and is scrolled into view when it changes.
 */
export const TagFilterBar = ({
  tags,
  active,
  onChange,
  allLabel = 'all',
  label = 'Filter by tag',
  className,
}: TagFilterBarProps) => {
  const scrollerRef = useRef<HTMLUListElement>(null)
  const [atEnd, setAtEnd] = useState(true)

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

  // Bring the active filter into view horizontally, without moving the page.
  useEffect(() => {
    const scroller = scrollerRef.current
    const item = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!scroller || !item) return
    const start = item.offsetLeft - scroller.offsetLeft
    const end = start + item.offsetWidth
    const gutter = 24
    if (start < scroller.scrollLeft + gutter) {
      scroller.scrollTo({ left: start - gutter, behavior: 'smooth' })
    } else if (end > scroller.scrollLeft + scroller.clientWidth - gutter) {
      scroller.scrollTo({
        left: end - scroller.clientWidth + gutter * 2,
        behavior: 'smooth',
      })
    }
  }, [active])

  return (
    <nav aria-label={label} className={cn('-mx-4', className)}>
      <ul
        ref={scrollerRef}
        onScroll={updateAtEnd}
        className={cn(
          'no-scrollbar flex items-stretch gap-x-3 overflow-x-auto overscroll-x-contain px-3',
          !atEnd && 'fade-x-end',
        )}
      >
        <li className="shrink-0">
          <FilterItem
            name={allLabel}
            pressed={active === null}
            onPress={() => onChange(null)}
          />
        </li>
        {tags.map(({ tag, count }) => (
          <li key={tag} className="shrink-0">
            <FilterItem
              name={tag}
              count={count}
              pressed={active === tag}
              onPress={() => onChange(active === tag ? null : tag)}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

type FilterItemProps = {
  name: string
  count?: number
  pressed: boolean
  onPress: () => void
}

const FilterItem = ({ name, count, pressed, onPress }: FilterItemProps) => {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onPress}
      className={cn(
        'group flex h-11 items-center rounded-sm px-1 text-sm whitespace-nowrap lowercase outline-hidden transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring focus-visible:outline-solid',
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
