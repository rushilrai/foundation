import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
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
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { convexQueryClient } = Route.useRouteContext()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>

      <body>
        <ClerkProvider>
          <ConvexProviderWithClerk
            client={convexQueryClient.convexClient}
            useAuth={useAuth}
          >
            {children}
          </ConvexProviderWithClerk>
        </ClerkProvider>

        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />

        <Scripts />
      </body>
    </html>
  )
}
