// Month grouping for the library list. Pass `timeZone` when the server and the
// browser must agree (SSR), otherwise the runtime's local zone is used.

type DateInput = Date | number

type DateOptions = {
  now?: DateInput
  timeZone?: string
}

export type MonthGroup<T> = {
  /** `YYYY-MM`, stable for React keys. */
  key: string
  /** "November" this year, "November 2025" otherwise. */
  label: string
  items: T[]
}

const yearMonth = (date: DateInput, timeZone?: string) => {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    timeZone,
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  return { year, month }
}

/** "November" for the current year, "November 2025" for any other. */
export const formatMonthLabel = (
  date: DateInput,
  { now = Date.now(), timeZone }: DateOptions = {},
) => {
  const sameYear =
    yearMonth(date, timeZone).year === yearMonth(now, timeZone).year
  return new Intl.DateTimeFormat('en', {
    month: 'long',
    year: sameYear ? undefined : 'numeric',
    timeZone,
  }).format(date)
}

/** "12 Nov" for the current year, "12 Nov 2025" for any other. */
export const formatSavedDate = (
  date: DateInput,
  { now = Date.now(), timeZone }: DateOptions = {},
) => {
  const sameYear =
    yearMonth(date, timeZone).year === yearMonth(now, timeZone).year
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
    timeZone,
  }).format(date)
}

/**
 * Splits an already date-sorted list into consecutive month groups, keeping order.
 */
export const groupByMonth = <T>(
  items: readonly T[],
  getDate: (item: T) => DateInput,
  options: DateOptions = {},
): MonthGroup<T>[] => {
  const groups: MonthGroup<T>[] = []

  for (const item of items) {
    const date = getDate(item)
    const { year, month } = yearMonth(date, options.timeZone)
    const key = `${year}-${month}`
    const last = groups.at(-1)

    if (last?.key === key) {
      last.items.push(item)
    } else {
      groups.push({
        key,
        label: formatMonthLabel(date, options),
        items: [item],
      })
    }
  }

  return groups
}
