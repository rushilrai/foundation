import { z } from 'zod'

// Home's URL search: the active tag filter, so Back and a reload keep it.
// A malformed value is dropped rather than failing the page.
export const homeSearchSchema = z.object({
  tag: z.string().optional().catch(undefined),
})

export type HomeSearch = z.infer<typeof homeSearchSchema>
