import type { TagCount } from '@shared/tags'

import {
  formatMonthLabel,
  yearMonth,
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
 */
export const groupByMonth = <T>(
  items: readonly T[],
  getDate: (item: T) => DateInput,
  context: DateContext,
): MonthGroup<T>[] => {
  const groups: MonthGroup<T>[] = []

  for (const item of items) {
    const date = getDate(item)
    const { year, month } = yearMonth(date, context.timeZone)
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
