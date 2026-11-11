import { convexAction, convexQuery } from '@convex-dev/react-query'
import { api } from '@convex/_generated/api'
import { useQuery } from '@tanstack/react-query'
import type { FunctionReturnType } from 'convex/server'
import { useMemo } from 'react'

import { countTags } from '@/modules/link/utils'

export type PreviewResult = FunctionReturnType<
  typeof api.modules.link.nodeActions.preview
>

// The page's title, image, description and suggested tags. Cached per URL
// for the session, so changing the link and coming back costs nothing.
export const previewQuery = (url: string) => ({
  ...convexAction(api.modules.link.nodeActions.preview, { url }),
  // A failed request is retried once; Save waits for it only briefly.
  retry: 1,
})

export function usePreviewQuery(url: string) {
  return useQuery(previewQuery(url))
}

const libraryQuery = convexQuery(api.modules.link.queries.list, {})

// The user's tags, most used first (for autocomplete), and their saved
// links, so a link already in the library is known before its preview.
export function useLibrary() {
  const { data } = useQuery(libraryQuery)
  const links = data && 'links' in data ? data.links : undefined

  const tags = useMemo(
    () => (links ? countTags(links).map(({ tag }) => tag) : []),
    [links],
  )

  return { links, tags }
}
