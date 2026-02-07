import { SignedIn, SignedOut } from '@clerk/tanstack-react-start'
import { IconArrowUpRight } from '@tabler/icons-react'
import { Link, Navigate, createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: IndexRouteComponent,
})

function IndexRouteComponent() {
  return (
    <div className="h-full w-full flex flex-col justify-center items-center">
      <SignedOut>
        <div className="flex flex-row w-full justify-center gap-12 items-center">
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold text-primary">CV Patch</h1>

            <p className="mt-1 text-muted-foreground max-w-sm">
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
