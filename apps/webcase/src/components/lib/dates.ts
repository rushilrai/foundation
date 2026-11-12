// Date display for the library. Both inputs are required: "this year" and
// the calendar day depend on the current time and on the time zone, so the
// server and the browser only render the same text when they are given the
// same `now` and `timeZone`. Screens either render date-dependent output on
// the client only, or pass both values from one place (e.g. the loader).

export type DateInput = Date | number

export type DateContext = {
  /** The current time in ms, e.g. from useClientDates (src/hooks). */
  now: number
  /** An IANA zone, e.g. `Asia/Kolkata`. */
  timeZone: string
}

/** The calendar year and month (`MM`) of a date in `timeZone`. */
export const yearMonth = (date: DateInput, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    timeZone,
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  return { year, month }
}

const isSameYear = (date: DateInput, { now, timeZone }: DateContext) =>
  yearMonth(date, timeZone).year === yearMonth(now, timeZone).year

/** "November" for the current year, "November 2025" for any other. */
export const formatMonthLabel = (date: DateInput, context: DateContext) =>
  new Intl.DateTimeFormat('en', {
    month: 'long',
    year: isSameYear(date, context) ? undefined : 'numeric',
    timeZone: context.timeZone,
  }).format(date)

/** "12 Nov" for the current year, "12 Nov 2025" for any other. */
export const formatSavedDate = (date: DateInput, context: DateContext) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: isSameYear(date, context) ? undefined : 'numeric',
    timeZone: context.timeZone,
  }).format(date)

/** "12 November 2025 at 14:05": a saved link's full date and time. */
export const formatSavedDateTime = (
  date: DateInput,
  { timeZone }: Pick<DateContext, 'timeZone'>,
) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
    .format(date)
    .replace(', ', ' at ')

/** "November 2025", always with the year (e.g. the span of an import). */
export const formatMonthYear = (
  date: DateInput,
  { timeZone }: Pick<DateContext, 'timeZone'>,
) =>
  new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone,
  }).format(date)
