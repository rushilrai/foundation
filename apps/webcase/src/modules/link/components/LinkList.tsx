import type { Doc } from '@convex/_generated/dataModel'
import { memo, useMemo } from 'react'

import type { DateContext } from '@/components/lib/dates'
import { LinkRow, LinkRowSkeleton } from '@/components/LinkRow'
import { MonthHeading } from '@/components/MonthHeading'
import { Skeleton } from '@/components/ui/skeleton'
import { useRenderLimit } from '@/hooks/useRenderLimit'
import { groupByMonth, takeFromGroups } from '../utils'

type LinkListProps = {
  links: readonly Doc<'links'>[]
  dates: DateContext
  /** Changes when the search or filter does; rendering starts over from the top. */
  resetKey: string
  onOpen: (link: Doc<'links'>) => void
  onTagSelect: (tag: string) => void
}

/**
 * The library grouped by the month each link was saved, newest first.
 * Renders a page of rows at a time and adds more as the user scrolls, so a
 * library of thousands stays quick.
 */
export const LinkList = ({
  links,
  dates,
  resetKey,
  onOpen,
  onTagSelect,
}: LinkListProps) => {
  const { limit, more, sentinelRef } = useRenderLimit(resetKey, links.length)

  const allGroups = useMemo(
    () => groupByMonth(links, (link) => link.savedAt, dates),
    [links, dates],
  )
  const groups = useMemo(
    () => takeFromGroups(allGroups, limit),
    [allGroups, limit],
  )

  return (
    <div>
      {groups.map((group) => (
        <MonthSection
          key={group.key}
          label={group.label}
          links={group.items}
          dates={dates}
          onOpen={onOpen}
          onTagSelect={onTagSelect}
        />
      ))}
      {more && (
        <div ref={sentinelRef}>
          <LinkRowSkeleton />
          <LinkRowSkeleton />
        </div>
      )}
    </div>
  )
}

type MonthSectionProps = {
  label: string
  links: readonly Doc<'links'>[]
  dates: DateContext
  onOpen: (link: Doc<'links'>) => void
  onTagSelect: (tag: string) => void
}

// Memoised so adding the next page renders only the new rows.
const MonthSection = memo(function MonthSection({
  label,
  links,
  dates,
  onOpen,
  onTagSelect,
}: MonthSectionProps) {
  return (
    <section
      aria-label={label}
      // Months off screen skip layout and paint, so a long scrolled list
      // stays cheap; the estimate (a row is ~110px) keeps the scrollbar steady.
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: `auto ${links.length * 110 + 56}px`,
      }}
    >
      <MonthHeading>{label}</MonthHeading>
      {links.map((link) => (
        <LinkItem
          key={link._id}
          link={link}
          dates={dates}
          onOpen={onOpen}
          onTagSelect={onTagSelect}
        />
      ))}
    </section>
  )
})

type LinkItemProps = {
  link: Doc<'links'>
  dates: DateContext
  onOpen: (link: Doc<'links'>) => void
  onTagSelect: (tag: string) => void
}

/** One row: the title opens the page itself, the rest of the row the details. */
export const LinkItem = memo(function LinkItem({
  link,
  dates,
  onOpen,
  onTagSelect,
}: LinkItemProps) {
  return (
    <LinkRow
      {...link}
      {...dates}
      titleOpensLink
      onSelect={() => onOpen(link)}
      onTagSelect={onTagSelect}
    />
  )
})

/** The list while the library loads. */
export const LinkListSkeleton = ({ rows = 8 }: { rows?: number }) => {
  return (
    <div role="status" aria-label="Loading your links">
      <div aria-hidden className="pt-8 pb-1">
        <Skeleton className="h-2.5 w-20 rounded-full" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <LinkRowSkeleton key={index} />
      ))}
    </div>
  )
}
