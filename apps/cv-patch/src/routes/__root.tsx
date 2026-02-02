import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

import styles from '../index.css?url'

const getAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  const authObject = await auth()

  if (!authObject.userId) {
    return { token: null, userId: null }
  }

  const token = await authObject.getToken({ template: 'convex' })

  return {
    token,
    userId: authObject.userId,
  }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: styles,
      },
    ],
  }),
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') {
      const { token } = await getAuthToken()

      if (token && context.convexQueryClient.serverHttpClient) {
        context.convexQueryClient.serverHttpClient.setAuth(token)
      }
    }

    return {}
  },
  shellComponent: RootComponent,
})

function RootComponent() {
  const { convexQueryClient } = Route.useRouteContext()

  return (
    <RootDocument>
      <ClerkProvider>
        <ConvexProviderWithClerk
          client={convexQueryClient.convexClient}
          useAuth={useAuth}
        >
          <Outlet />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>

      <body className="h-screen">
        {children}

        <Scripts />
      </body>
    </html>
  )
}
