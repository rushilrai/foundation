import { createRouter } from '@tanstack/react-router'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'

import { createConvexClient } from '@/lib/convex/client'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const { convexQueryClient, queryClient } = createConvexClient()

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: 'intent',
      context: { queryClient, convexQueryClient },
      scrollRestoration: true,
    }),
    queryClient,
  )

  return router
}
