import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { requireSignedIn } from '@/modules/auth/guards'
import { SaveScreen } from '@/screens/save'

// The share target (see public/manifest.json) opens this with what the
// sharing app sent; Android often puts the link in `text`.
const saveSearchSchema = z.object({
  url: z.string().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
})

export const Route = createFileRoute('/save')({
  validateSearch: saveSearchSchema,
  beforeLoad: requireSignedIn,
  head: () => ({ meta: [{ title: 'Save · Webcase' }] }),
  component: SaveScreen,
})
