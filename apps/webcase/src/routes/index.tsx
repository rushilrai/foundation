import { Show } from '@clerk/tanstack-react-start'
import { IconArrowUpRight } from '@tabler/icons-react'
import { createFileRoute, Link, Navigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: IndexRouteComponent,
})

function IndexRouteComponent() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <Show when="signed-out">
        <div className="flex flex-row items-center gap-12">
          <div className="flex flex-col">
            <h1 className="text-4xl font-semibold text-primary">WebCase.</h1>

            <p className="mt-1 max-w-sm text-muted-foreground">
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
      </Show>

      <Show when="signed-in">
        <Navigate to="/home" />
      </Show>
    </div>
  )
}
