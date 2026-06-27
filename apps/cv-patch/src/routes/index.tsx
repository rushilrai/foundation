import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { IconArrowUpRight } from '@tabler/icons-react'
import { createFileRoute, Link, Navigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: IndexRouteComponent,
})

function IndexRouteComponent() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <SignedOut>
        <div className="flex w-full flex-row items-center justify-center gap-12">
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold text-primary">CV Patch</h1>

            <p className="mt-1 max-w-sm text-muted-foreground">
              Upload your resume and tailor it to any job.
              <br />
              AI-powered, instant, and effortless.
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
            src="/images/cv-patch-graphic.png"
            alt="CV Patch Graphic"
            className="w-96"
          />
        </div>
      </SignedOut>

      <SignedIn>
        <Navigate to="/dashboard/home" />
      </SignedIn>
    </div>
  )
}
