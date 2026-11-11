import { createFileRoute } from '@tanstack/react-router'

import { requireSignedIn } from '@/modules/auth/guards'
import { ImportScreen } from '@/screens/import'

export const Route = createFileRoute('/import')({
  beforeLoad: requireSignedIn,
  head: () => ({ meta: [{ title: 'Import · Webcase' }] }),
  component: ImportScreen,
})
