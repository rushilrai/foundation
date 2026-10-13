import { SignOutButton, useUser } from '@clerk/tanstack-react-start'
import { IconFileText, IconLogout, IconPlus } from '@tabler/icons-react'
import { Link, useLocation } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { UploadResumeDialog } from '@/modules/resume/components/UploadResumeDialog'
import { useResumeList } from '@/modules/resume/queries'

export const AppSidebar = () => {
  const location = useLocation()
  const resumesResult = useResumeList()
  const { user } = useUser()

  const resumes =
    resumesResult && !('error' in resumesResult) ? resumesResult.resumes : []

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <span className="text-2xl font-bold text-primary">CV Patch</span>

        <UploadResumeDialog>
          <Button variant="default" size="icon-sm">
            <IconPlus className="size-4" />
          </Button>
        </UploadResumeDialog>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Resumes</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {resumes.map((resume) => (
                <SidebarMenuItem key={resume._id}>
                  <SidebarMenuButton
                    isActive={
                      location.pathname === `/dashboard/resume/${resume._id}`
                    }
                    render={
                      <Link
                        to="/dashboard/resume/$id"
                        params={{ id: resume._id }}
                      >
                        <IconFileText className="size-4" />
                        <span className="truncate">{resume.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              ))}

              {resumes.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">
                  No resumes yet
                </p>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="flex-row items-center justify-between p-4">
        <span className="truncate text-sm">{user?.fullName}</span>

        <SignOutButton>
          <Button variant="outline" size="icon-sm">
            <IconLogout className="size-4" />
          </Button>
        </SignOutButton>
      </SidebarFooter>
    </Sidebar>
  )
}
