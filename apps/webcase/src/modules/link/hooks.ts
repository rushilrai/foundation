import type { Id } from '@convex/_generated/dataModel'
import { MAX_QUESTION_LENGTH } from '@shared/limits'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { useAskLibrary } from './mutations'

// ---------------------------------------------------------------------------
// The device's clock and zone, for row dates and month groups.

export type ClientDates = { now: number; timeZone: string }

let clientDates: ClientDates | null = null

const readDevice = (): ClientDates => ({
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
export function useClientDates(): ClientDates | null {
  return useSyncExternalStore(subscribeDates, getClientDates, () => null)
}

// ---------------------------------------------------------------------------
// Asking the library a question.

export type AskState =
  | { status: 'idle' }
  | { status: 'asking'; question: string }
  | {
      status: 'answered'
      question: string
      answer: string
      linkIds: Id<'links'>[]
    }
  | { status: 'failed'; question: string; message: string }

const ASK_ERRORS: Record<string, string> = {
  UNAUTHORIZED: 'You’re signed out. Sign in again to ask.',
  INVALID_QUESTION: `Ask in ${MAX_QUESTION_LENGTH} characters or fewer.`,
  RATE_LIMITED: 'You’ve asked a lot for now. Try again later.',
  AI_UNAVAILABLE: 'Asking isn’t available right now.',
}

const NETWORK_ERROR = 'Couldn’t reach Webcase. Check your connection.'

/** One question at a time; a reset or a newer question drops a late answer. */
export function useAsk() {
  const askLibrary = useAskLibrary()
  const [state, setState] = useState<AskState>({ status: 'idle' })
  const requestRef = useRef(0)

  const ask = useCallback(
    async (question: string) => {
      const request = ++requestRef.current
      setState({ status: 'asking', question })
      try {
        const result = await askLibrary({ question })
        if (request !== requestRef.current) return
        setState(
          'error' in result
            ? { status: 'failed', question, message: ASK_ERRORS[result.error] }
            : { status: 'answered', question, ...result },
        )
      } catch (error) {
        if (request !== requestRef.current) return
        console.error('Error asking the library', error)
        setState({ status: 'failed', question, message: NETWORK_ERROR })
      }
    },
    [askLibrary],
  )

  const reset = useCallback(() => {
    requestRef.current += 1
    setState((current) =>
      current.status === 'idle' ? current : { status: 'idle' },
    )
  }, [])

  return { state, ask, reset }
}

// ---------------------------------------------------------------------------
// Rendering a long list a page at a time.

/**
 * How many items to render: `step` at first, `step` more each time the
 * returned sentinel comes within a screen or so of the viewport. Starts
 * over when `resetKey` changes (a new search or filter).
 */
export function useRenderLimit(resetKey: string, total: number, step = 60) {
  const [state, setState] = useState({ key: resetKey, limit: step })
  const limit = state.key === resetKey ? state.limit : step
  if (state.key !== resetKey) setState({ key: resetKey, limit: step })

  const [sentinel, setSentinel] = useState<HTMLElement | null>(null)
  const more = limit < total

  // A new observer after every step reports straight away if the sentinel
  // is still in range (a tall screen), so rendering continues until full.
  useEffect(() => {
    if (!sentinel || !more) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setState({ key: resetKey, limit: limit + step })
        }
      },
      { rootMargin: '1200px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [sentinel, more, limit, resetKey, step])

  return { limit, more, sentinelRef: setSentinel }
}
