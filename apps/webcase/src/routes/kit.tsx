import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
} from '@tanstack/react-router'

// The component gallery: dev only, and no sign-in needed.
export const Route = createFileRoute('/kit')({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  head: () => ({ meta: [{ title: 'Kit · Webcase' }] }),
  component: lazyRouteComponent(() => import('@/screens/kit'), 'KitScreen'),
})
