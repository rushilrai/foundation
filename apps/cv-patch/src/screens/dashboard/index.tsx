import { Outlet } from '@tanstack/react-router'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useEnsureUser } from '@/modules/auth/mutations'
import { AppSidebar } from './components/app-sidebar'

export function DashboardScreen() {
  useEnsureUser()

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}
