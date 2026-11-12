import type { TagCount } from '@shared/tags'

import {
  formatMonthLabel,
  type DateContext,
  type DateInput,
} from '@/components/lib/dates'

export type MonthGroup<T> = {
  /** `YYYY-MM`, stable for React keys. */
  key: string
  /** "November" this year, "November 2025" otherwise. */
  label: string
  items: T[]
}

/**
 * Splits an already date-sorted list into consecutive month groups, keeping
 * order. `now` and `timeZone` are required for the same reason as in
 * components/lib/dates.ts: the server and browser must agree.
 * One formatter serves the whole pass (building one per item is slow for a
 * library of thousands); it gives the same year and month as `yearMonth`.
 */
export const groupByMonth = <T>(
  items: readonly T[],
  getDate: (item: T) => DateInput,
  context: DateContext,
): MonthGroup<T>[] => {
  const groups: MonthGroup<T>[] = []
  const formatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    timeZone: context.timeZone,
  })

  for (const item of items) {
    const date = getDate(item)
    const parts = formatter.formatToParts(date)
    const year = parts.find((part) => part.type === 'year')?.value ?? ''
    const month = parts.find((part) => part.type === 'month')?.value ?? ''
    const key = `${year}-${month}`
    const last = groups.at(-1)

    if (last?.key === key) {
      last.items.push(item)
    } else {
      groups.push({
        key,
        label: formatMonthLabel(date, context),
        items: [item],
      })
    }
  }

  return groups
}

/**
 * The first `limit` items across groups. Groups shown in full keep their
 * identity, so memoised sections above the cut do not render again.
 */
export const takeFromGroups = <T>(
  groups: readonly MonthGroup<T>[],
  limit: number,
): MonthGroup<T>[] => {
  const taken: MonthGroup<T>[] = []
  let left = limit

  for (const group of groups) {
    if (left <= 0) break
    if (group.items.length <= left) {
      taken.push(group)
      left -= group.items.length
    } else {
      taken.push({ ...group, items: group.items.slice(0, left) })
      left = 0
    }
  }

  return taken
}

/** Tag counts across links, most used first, then by name. */
export const countTags = (
  links: readonly { tags: readonly string[] }[],
): TagCount[] => {
  const counts = new Map<string, number>()
  for (const link of links) {
    for (const tag of link.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }

  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
