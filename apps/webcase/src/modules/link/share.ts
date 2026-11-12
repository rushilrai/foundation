export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Hands the URL to the system share sheet where there is one (phones),
 * otherwise copies it. A cancelled share sheet is not an error.
 */
export async function shareLink(link: {
  url: string
  title: string
}): Promise<ShareOutcome> {
  const data = { url: link.url, title: link.title }
  if (
    typeof navigator.share === 'function' &&
    (navigator.canShare?.(data) ?? true)
  ) {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled'
      }
      // e.g. NotAllowedError without a user gesture: fall back to copying.
    }
  }

  try {
    await navigator.clipboard.writeText(link.url)
    return 'copied'
  } catch (error) {
    console.error('Error copying the link', error)
    return 'failed'
  }
}
