import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router'

import { authClient } from '@/modules/auth/client'
import { getAuthToken } from '@/modules/auth/functions'
import styles from '../index.css?url'

const DESCRIPTION = 'Your saved links, tagged and searchable.'
// Matches --background in index.css.
const THEME_COLOR = '#ffffff'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Webcase' },
      { name: 'description', content: DESCRIPTION },
      { name: 'theme-color', content: THEME_COLOR },
      { name: 'color-scheme', content: 'light' },
    ],
    links: [{ rel: 'stylesheet', href: styles }],
  }),
  beforeLoad: async ({ context }) => {
    const token = await getAuthToken()

    // Only set during SSR: authenticates the server's Convex queries.
    if (token) context.convexQueryClient.serverHttpClient?.setAuth(token)

    return { isAuthenticated: token !== null, token }
  },
  shellComponent: RootComponent,
})

function RootComponent() {
  const { convexQueryClient, queryClient, token } = Route.useRouteContext()

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <ConvexBetterAuthProvider
          client={convexQueryClient.convexClient}
          authClient={authClient}
          initialToken={token}
        >
          <Outlet />
        </ConvexBetterAuthProvider>
      </QueryClientProvider>
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>

      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}

        <Scripts />
      </body>
    </html>
  )
}
