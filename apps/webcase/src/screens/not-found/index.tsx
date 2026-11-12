import { Link } from '@tanstack/react-router'

import { FallbackPage } from '@/components/FallbackPage'
import { Button } from '@/components/ui/button'

// Any URL no route matches.
export const NotFoundScreen = () => {
  return (
    <FallbackPage
      title="There’s nothing at this address."
      actions={
        <Button
          size="lg"
          className="h-11 px-5"
          nativeButton={false}
          render={<Link to="/" />}
        >
          Go to your library
        </Button>
      }
    />
  )
}
