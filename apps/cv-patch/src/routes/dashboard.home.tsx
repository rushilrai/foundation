import { IconFiles } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { DashboardHeader } from '@/modules/common/components/DashboardHeader'

export const Route = createFileRoute('/dashboard/home')({
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <DashboardHeader title="Home" />

      <div className="flex h-full w-full items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconFiles />
            </EmptyMedia>

            <EmptyTitle>No Resume Selected</EmptyTitle>

            <EmptyDescription>
              Get started by creating selecting a resume from sidebar or
              uploading one.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </>
  )
}
