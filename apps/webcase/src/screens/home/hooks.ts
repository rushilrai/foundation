import { useEffect } from 'react'

/** `/` jumps to search, as on most sites with one. */
export function useSearchShortcut(
  searchRef: React.RefObject<HTMLInputElement | null>,
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]') ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        return
      }
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchRef])
}
