import { IconFiles } from '@tabler/icons-react'

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { DashboardHeader } from '@/screens/dashboard/components/dashboard-header'

export function HomeScreen() {
  return (
    <>
      <DashboardHeader title="Home" />

      <div className="flex h-full w-full items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconFiles />
            </EmptyMedia>

            <EmptyTitle>No Profile Selected</EmptyTitle>

            <EmptyDescription>
              Get started by selecting a profile from the sidebar or creating
              one.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </>
  )
}
