import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'

import { DashboardSidebar } from './DashboardSidebar'

type DashboardLayoutProps = {
  children: React.ReactNode
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <SidebarProvider>
      <DashboardSidebar />

      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
