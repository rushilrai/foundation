import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'

import { requireSignedIn } from '@/modules/auth/guards'
import { currentUserQuery } from '@/modules/auth/queries'
import { homeSearchSchema } from '@/modules/link/schema'
import { saveSearchSchema } from '@/modules/save/schema'
import { HomeScreen } from '@/screens/home'
import { SaveSheet } from '@/screens/save'

// The library, under `/` and under `/save`, so the save sheet opens over it
// without the library remounting. `tag` is read here, so the filter holds
// while the sheet is open.
export const Route = createFileRoute('/_library')({
  validateSearch: homeSearchSchema,
  beforeLoad: requireSignedIn,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(currentUserQuery),
  component: LibraryRoute,
})

function LibraryRoute() {
  const { tag } = Route.useSearch()
  const navigate = useNavigate()

  // Each filter change is a history entry, so Back returns to the last one.
  const setTag = useCallback(
    (next: string | null) =>
      void navigate({ to: '/', search: { tag: next ?? undefined } }),
    [navigate],
  )

  // The sheet follows the location, which changes as soon as a navigation
  // starts, rather than the matched route, which waits for the root's auth
  // check (a server round trip). So it opens and closes at once.
  const rawSave = useLocation({
    select: (location) =>
      location.pathname === '/save' ? location.search : null,
  })
  const saveSearch = useMemo(
    () => (rawSave ? saveSearchSchema.parse(rawSave) : null),
    [rawSave],
  )

  return (
    <>
      <HomeScreen tag={tag} onTagChange={setTag} />
      <SaveSheet search={saveSearch} />
      <Outlet />
    </>
  )
}
