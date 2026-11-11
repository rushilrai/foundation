import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { createConvexClient } from '@/lib/convex/client'
import { ErrorScreen } from '@/screens/error'
import { NotFoundScreen } from '@/screens/not-found'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const { convexQueryClient, queryClient } = createConvexClient()

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    context: { queryClient, convexQueryClient },
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundScreen,
    defaultErrorComponent: ErrorScreen,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}
