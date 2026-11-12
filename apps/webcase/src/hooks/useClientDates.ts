import { useSyncExternalStore } from 'react'

import type { DateContext } from '@/components/lib/dates'

// The device's clock and zone, for row dates and month groups.

let clientDates: DateContext | null = null

const readDevice = (): DateContext => ({
  now: Date.now(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
})

const getClientDates = () => {
  clientDates ??= readDevice()
  return clientDates
}

// Coming back to an installed app after a while (a new day, a new year, a
// trip abroad) refreshes the dates.
const subscribeDates = (onChange: () => void) => {
  const refresh = () => {
    if (document.visibilityState !== 'visible') return
    const next = readDevice()
    if (
      !clientDates ||
      next.timeZone !== clientDates.timeZone ||
      next.now - clientDates.now > 60_000
    ) {
      clientDates = next
      onChange()
    }
  }
  document.addEventListener('visibilitychange', refresh)
  return () => document.removeEventListener('visibilitychange', refresh)
}

/**
 * `now` and `timeZone` from the device, or null during SSR and hydration,
 * so date-dependent output only ever renders in the browser.
 */
export function useClientDates(): DateContext | null {
  return useSyncExternalStore(subscribeDates, getClientDates, () => null)
}
