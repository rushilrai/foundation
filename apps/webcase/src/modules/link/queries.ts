import { convexAction, convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useQuery } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'

import { countTags } from './utils'

// The one place the link queries and the preview action are wrapped.

export const linksQuery = convexQuery(api.modules.link.queries.list, {})

export type LibraryStatus = 'loading' | 'error' | 'signedOut' | 'ready'

/**
 * The signed-in user's whole library, newest saved first, kept live by the
 * Convex subscription, with its tags most used first. Not loaded on the
 * server: dates render on the client only, and a large library would bloat
 * the page.
 */
export function useLibrary() {
  const query = useQuery(linksQuery)
  const links =
    query.data && 'links' in query.data ? query.data.links : undefined

  const tagCounts = useMemo(() => countTags(links ?? []), [links])
  const tags = useMemo(() => tagCounts.map(({ tag }) => tag), [tagCounts])

  const status: LibraryStatus = query.isError
    ? 'error'
    : query.data && 'error' in query.data
      ? 'signedOut'
      : links
        ? 'ready'
        : 'loading'

  return { status, links, tagCounts, tags }
}

export type PreviewResult = FunctionReturnType<
  typeof api.modules.link.nodeActions.preview
>

/**
 * The page's title, image, description and suggested tags. Cached per URL
 * for the session, so changing the link and coming back costs nothing.
 */
export const previewQuery = (url: string) => ({
  ...convexAction(api.modules.link.nodeActions.preview, { url }),
  // A failed request is retried once; Save waits for it only briefly.
  retry: 1,
})

export function usePreview(url: string) {
  return useQuery(previewQuery(url))
}
