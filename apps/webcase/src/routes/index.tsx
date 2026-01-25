import { Button } from '@/components/ui/button'
import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { IconArrowUpRight } from '@tabler/icons-react'
import { createFileRoute, Link, Navigate } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: IndexRouteComponent,
})

function IndexRouteComponent() {
  return (
    <div className="h-full w-full flex flex-col justify-center items-center">
      <SignedOut>
        <div className="flex flex-row gap-12 items-center">
          <div className="flex flex-col">
            <h1 className="text-4xl font-semibold text-primary">WebCase.</h1>

            <p className="mt-1 text-muted-foreground max-w-sm">
              Save articles, videos, and links from anywhere.
              <br />
              Read them later, distraction-free.
            </p>

            <Button
              className="mt-4 max-w-36"
              render={
                <Link to="/sign-in/$">
                  Get Started <IconArrowUpRight />
                </Link>
              }
            />
          </div>

          <img
            src="/images/webcase-graphic.png"
            alt="Webcase Graphic"
            className="w-64"
          />
        </div>
      </SignedOut>

      <SignedIn>
        <Navigate to="/home" />
      </SignedIn>
    </div>
  )
}
