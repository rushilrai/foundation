import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { FallbackPage } from '@/components/FallbackPage'
import { Button } from '@/components/ui/button'

// A page that failed to load or render. The error itself is logged, and
// shown on the page only during development.
export const ErrorScreen = ({ error, reset }: ErrorComponentProps) => {
  const router = useRouter()

  useEffect(() => {
    console.error('Error rendering the page', error)
  }, [error])

  return (
    <FallbackPage
      title="Something went wrong on this page."
      actions={
        <>
          <Button
            size="lg"
            className="h-11 px-5"
            onClick={() => {
              // Loads the route again, then lets it render again.
              void router.invalidate().then(reset)
            }}
          >
            Try again
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="h-11 px-5 text-muted-foreground"
            nativeButton={false}
            render={<Link to="/" reloadDocument />}
          >
            Go to your library
          </Button>
        </>
      }
      footnote={
        import.meta.env.DEV && (
          <p className="mt-8 font-mono text-2xs break-all text-faint-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        )
      }
    />
  )
}
