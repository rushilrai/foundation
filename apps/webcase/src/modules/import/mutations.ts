import type { api } from '@convex/_generated/api'
import { DAILY_IMPORT_LIMIT, MAX_IMPORT_BATCH } from '@shared/limits'
import { useCallback, useEffect, useRef, useState } from 'react'

import { messageFor, MESSAGES, type ErrorMessages } from '@/modules/link/errors'
import { useImportLinks } from '@/modules/link/mutations'
import type { PocketItem } from './pocket'

export type ImportTotals = {
  imported: number
  /** Already saved, or repeated in the file. */
  skipped: number
  /** An unusable URL or date. */
  invalid: number
}

export type ImportRun =
  | { status: 'idle' }
  | { status: 'running'; sent: number; totals: ImportTotals }
  | { status: 'stopped'; sent: number; totals: ImportTotals; error: string }
  | { status: 'finished'; totals: ImportTotals }

const NO_TOTALS: ImportTotals = { imported: 0, skipped: 0, invalid: 0 }

const STOP_MESSAGES: ErrorMessages<
  typeof api.modules.link.mutations.importMany
> = {
  RATE_LIMITED: `Webcase imports up to ${DAILY_IMPORT_LIMIT.toLocaleString('en')} links a day. Resume tomorrow for the rest.`,
  UNAUTHORIZED: MESSAGES.UNAUTHORIZED,
  TOO_MANY_ITEMS: 'The server refused a batch. Try again.',
}
const NETWORK_MESSAGE = 'Lost the connection. Resume when you’re back online.'

/**
 * Sends a parsed export to `importMany`, one batch of MAX_IMPORT_BATCH at a
 * time. Stops at the first refused or failed batch; `start` then resumes
 * from that batch. Running it again is safe: links already in the library
 * are skipped and do not count against the daily allowance.
 *
 * Hand-rolled rather than TanStack's useMutation: one run is many calls
 * with progress after each and a resume point kept across stops, which a
 * single mutation's state does not hold.
 */
export function useImportRun(items: readonly PocketItem[]) {
  const importMany = useImportLinks()
  const [run, setRunState] = useState<ImportRun>({ status: 'idle' })
  // The latest run, for `start` to resume from without re-creating itself.
  const runRef = useRef(run)
  const active = useRef(false)
  const mounted = useRef(true)

  const setRun = useCallback((next: ImportRun) => {
    runRef.current = next
    setRunState(next)
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      // Leaving the page ends the run after the batch in flight.
      mounted.current = false
    }
  }, [])

  const start = useCallback(async () => {
    if (active.current) return
    active.current = true

    const previous = runRef.current
    let sent = previous.status === 'stopped' ? previous.sent : 0
    const totals = {
      ...(previous.status === 'stopped' ? previous.totals : NO_TOTALS),
    }
    setRun({ status: 'running', sent, totals: { ...totals } })

    const stop = (error: string) =>
      setRun({ status: 'stopped', sent, totals: { ...totals }, error })

    try {
      while (sent < items.length) {
        if (!mounted.current) return
        const batch = items.slice(sent, sent + MAX_IMPORT_BATCH)

        let result: Awaited<ReturnType<typeof importMany>>
        try {
          result = await importMany({ items: batch })
        } catch (error) {
          console.error('Error importing a batch', error)
          return stop(NETWORK_MESSAGE)
        }
        if ('error' in result) {
          return stop(messageFor(STOP_MESSAGES, result.error))
        }

        totals.imported += result.imported
        totals.skipped += result.skipped
        totals.invalid += result.invalid
        sent += batch.length
        setRun({ status: 'running', sent, totals: { ...totals } })
      }

      setRun({ status: 'finished', totals: { ...totals } })
    } finally {
      active.current = false
    }
  }, [importMany, items, setRun])

  const reset = useCallback(() => {
    if (!active.current) setRun({ status: 'idle' })
  }, [setRun])

  return { run, start, reset }
}
