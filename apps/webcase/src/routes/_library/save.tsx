import { createFileRoute } from '@tanstack/react-router'

import { saveSearchSchema } from '@/modules/save/schema'

// The save sheet's URL, which the share target opens. The layout
// (`_library.tsx`) draws the sheet from the location and checks sign-in.
export const Route = createFileRoute('/_library/save')({
  validateSearch: saveSearchSchema,
  head: () => ({ meta: [{ title: 'Save · Webcase' }] }),
})
