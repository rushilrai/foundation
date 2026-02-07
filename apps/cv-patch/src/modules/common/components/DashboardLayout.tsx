import { DashboardSidebar } from './DashboardSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'


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
