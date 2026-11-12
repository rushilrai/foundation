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
      // A private, signed-in library: nothing here is for search engines.
      { name: 'robots', content: 'noindex, nofollow' },
      // Installed app: standalone on Android and iOS, titled "Webcase" on the home screen.
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Webcase' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    ],
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
