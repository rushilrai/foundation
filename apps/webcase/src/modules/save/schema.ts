import { z } from 'zod'

import { searchText } from '@/lib/searchParams'

// What the share target (see public/manifest.json) or any other tool puts
// in /save's search params; Android often puts the link in `text`. Any
// value is accepted as text, so a page titled "2048" can still be shared.
export const saveSearchSchema = z.object({
  url: searchText,
  title: searchText,
  text: searchText,
})

export type SharedPayload = z.infer<typeof saveSearchSchema>

// /open's search: `link` is the whole `web+webcase:` URL the operating
// system handed the installed app (the manifest's `protocol_handlers`).
export const openSearchSchema = z.object({
  link: searchText,
})
