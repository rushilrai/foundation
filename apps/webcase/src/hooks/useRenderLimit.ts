import { useEffect, useState } from 'react'

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
