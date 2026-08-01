import { SignOutButton, useUser } from '@clerk/tanstack-react-start'
import {
  IconLogout,
  IconPlus,
  IconUserSquareRounded,
} from '@tabler/icons-react'
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
import { CreateProfileDialog } from '@/modules/profile/components/CreateProfileDialog'
import { useProfileList } from '@/modules/profile/queries'

export const AppSidebar = () => {
  const location = useLocation()
  const profilesResult = useProfileList()
  const { user } = useUser()

  const profiles =
    profilesResult && !('error' in profilesResult)
      ? profilesResult.profiles
      : []

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <span className="text-2xl font-bold text-primary">CV Patch</span>

        <CreateProfileDialog>
          <Button variant="default" size="icon-sm">
            <IconPlus className="size-4" />
          </Button>
        </CreateProfileDialog>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Profiles</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {profiles.map((profile) => {
                const basePath = `/dashboard/profile/${profile._id}`
                const isActive =
                  location.pathname === basePath ||
                  location.pathname.startsWith(`${basePath}/`)

                return (
                  <SidebarMenuItem key={profile._id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={
                        <Link
                          to="/dashboard/profile/$id"
                          params={{ id: profile._id }}
                        >
                          <IconUserSquareRounded className="size-4" />
                          <span className="truncate">{profile.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                )
              })}

              {profiles.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">
                  No profiles yet
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
