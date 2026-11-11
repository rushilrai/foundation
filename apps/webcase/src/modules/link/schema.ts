import { z } from 'zod'

import { searchText } from '@/lib/searchParams'

// Home's URL search: the active tag filter, so Back and a reload keep it.
// Any value is read as text (a tag may be "2048"); it is normalised where
// it is used.
export const homeSearchSchema = z.object({
  tag: searchText,
})

export type HomeSearch = z.infer<typeof homeSearchSchema>
