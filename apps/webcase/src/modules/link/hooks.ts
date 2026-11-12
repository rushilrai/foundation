import {
  useLocation,
  useRouter,
  type HistoryState,
} from '@tanstack/react-router'

// History state on links from the library (Home) into another page, so
// that page can go back to the library instead of opening it again.
// HistoryState has no app keys to declare it with (its package is not a
// direct dependency), hence the cast.
export const FROM_LIBRARY = { fromLibrary: true } as HistoryState

const cameFromLibrary = (state: unknown) =>
  (state as { fromLibrary?: unknown } | undefined)?.fromLibrary === true

/**
 * Leaving a page for the library. When the library opened this page, it
 * goes back there, so its filter and scroll position return and no second
 * Home entry is added (Back from it then leaves the installed app). On a
 * cold open (a share, a direct link) it replaces this page with Home.
 */
export function useReturnToLibrary() {
  const router = useRouter()
  const fromLibrary = useLocation({
    select: (location) => cameFromLibrary(location.state),
  })

  const returnToLibrary = () => {
    if (fromLibrary) router.history.back()
    else void router.navigate({ to: '/', search: {}, replace: true })
  }

  /** For a link to `/`: goes back instead when that is the same place. */
  const onLibraryLinkClick = (event: React.MouseEvent) => {
    if (!fromLibrary || event.metaKey || event.ctrlKey || event.shiftKey) {
      return
    }
    event.preventDefault()
    router.history.back()
  }

  return { fromLibrary, returnToLibrary, onLibraryLinkClick }
}
