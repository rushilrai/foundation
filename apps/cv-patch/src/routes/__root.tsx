import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

import styles from '../index.css?url'

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
        title: 'CV Patch',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: styles,
      },
    ],
  }),
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
