import { Outlet } from '@tanstack/react-router'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from './components/app-sidebar'

export function DashboardScreen() {
  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
