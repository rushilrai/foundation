import { useEffect, useState } from 'react'

// How far an on-screen keyboard covers the bottom of the layout viewport,
// in px. iOS and Android (by default) overlay the keyboard instead of
// resizing the page, so a bar pinned to the bottom would sit under it.
// Zero while the page is pinch-zoomed, where the visual viewport is
// smaller for another reason.
export function useKeyboardInset() {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop
      setInset(
        Math.abs(viewport.scale - 1) < 0.01 && covered > 1
          ? Math.round(covered)
          : 0,
      )
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
