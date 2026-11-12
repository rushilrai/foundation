import { createFileRoute } from '@tanstack/react-router'

import { requireSignedIn } from '@/modules/auth/guards'
import { saveSearchSchema } from '@/modules/save/schema'
import { SaveScreen } from '@/screens/save'

export const Route = createFileRoute('/save')({
  validateSearch: saveSearchSchema,
  beforeLoad: requireSignedIn,
  head: () => ({ meta: [{ title: 'Save · Webcase' }] }),
  component: SaveRoute,
})

function SaveRoute() {
  const search = Route.useSearch()

  return <SaveScreen search={search} />
}
