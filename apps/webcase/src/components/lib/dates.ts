// Date display for the library. Both inputs are required: "this year" and
// the calendar day depend on the current time and on the time zone, so the
// server and the browser only render the same text when they are given the
// same `now` and `timeZone`. Screens either render date-dependent output on
// the client only, or pass both values from one place (e.g. the loader).

export type DateInput = Date | number

export type DateContext = {
  /** The current time, as ms or a Date. */
  now: DateInput
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
