import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentsTab } from '@/modules/profile/components/DocumentsTab'
import { ProfileChat } from '@/modules/profile/components/ProfileChat'
import { ProfileContentTab } from '@/modules/profile/components/ProfileContentTab'
import { useProfile } from '@/modules/profile/queries'
import type { ProfileId } from '@/modules/profile/schema'
import { DashboardHeader } from '@/screens/dashboard/components/dashboard-header'

export function ProfileDetailScreen({ profileId }: { profileId: string }) {
  const profileResult = useProfile(profileId as ProfileId)

  if (profileResult === undefined) {
    return (
      <>
        <DashboardHeader>
          <Skeleton className="h-6 w-48" />
        </DashboardHeader>

        <div className="flex min-h-0 flex-1">
          <div className="w-1/2 border-r p-6">
            <Skeleton className="h-full" />
          </div>

          <div className="w-1/2 p-6">
            <Skeleton className="h-full" />
          </div>
        </div>
      </>
    )
  }

  if ('error' in profileResult) {
    return (
      <>
        <DashboardHeader title="Error" />

        <div className="p-6">
          <p className="text-destructive">
            {profileResult.error === 'PROFILE_NOT_FOUND'
              ? 'Profile not found.'
              : 'An error occurred while loading the profile.'}
          </p>
        </div>
      </>
    )
  }

  const { profile } = profileResult

  return (
    <div className="flex h-svh flex-col">
      <DashboardHeader title={profile.title} />

      <div className="flex min-h-0 flex-1 flex-row">
        <div className="flex w-1/2 min-w-0 flex-col border-r">
          <ProfileChat profile={profile} />
        </div>

        <div className="flex w-1/2 min-w-0 flex-col overflow-y-auto p-6">
          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="mt-6">
              <ProfileContentTab profile={profile} />
            </TabsContent>

            <TabsContent value="documents" className="mt-6">
              <DocumentsTab profileId={profile._id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
