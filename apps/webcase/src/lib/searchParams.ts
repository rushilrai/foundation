import { z } from 'zod'

// TanStack Router JSON-parses each search value, so `?title=2048` arrives
// as a number, `?title=null` as null and `?q=[1]` as an array. A text param
// takes whatever arrived as the text it was written as, and never fails the
// page; only a missing param is undefined.
export const searchText = z
  .unknown()
  .transform((value): string | undefined => {
    if (typeof value === 'string') return value
    if (
      value === null ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value)
    }
    try {
      return JSON.stringify(value)
    } catch {
      return undefined
    }
  })
  .optional()
