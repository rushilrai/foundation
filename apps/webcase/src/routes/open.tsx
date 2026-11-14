import { createFileRoute, redirect } from '@tanstack/react-router'

import { requireSignedIn } from '@/modules/auth/guards'
import { openSearchSchema } from '@/modules/save/schema'
import { parseSchemeLink } from '@/modules/save/scheme'

// Where the operating system opens the installed app for a `web+webcase:`
// link (`protocol_handlers` in public/manifest.json). It only ever goes on,
// in place, to the save sheet with the link, or to the library: nothing is
// saved until Save is tapped.
export const Route = createFileRoute('/open')({
  validateSearch: openSearchSchema,
  beforeLoad: ({ context, location, search }) => {
    requireSignedIn({ context, location })

    const payload = parseSchemeLink(search.link)
    throw payload
      ? redirect({ to: '/save', search: payload, replace: true })
      : redirect({ to: '/', replace: true })
  },
})
