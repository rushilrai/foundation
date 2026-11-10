import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { createConvexClient } from '@/lib/convex/client'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const { convexQueryClient, queryClient } = createConvexClient()

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient, convexQueryClient },
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}
