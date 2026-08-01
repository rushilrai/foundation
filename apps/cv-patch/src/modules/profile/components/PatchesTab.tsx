import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CreatePatchDialog } from '@/modules/patch/components/CreatePatchDialog'
import { PatchCard } from '@/modules/patch/components/PatchCard'
import { usePatchesForProfile } from '@/modules/patch/queries'
import type { ProfileId } from '@/modules/profile/schema'

type PatchesTabProps = {
  profileId: ProfileId
}

export const PatchesTab = ({ profileId }: PatchesTabProps) => {
  const patchesResult = usePatchesForProfile(profileId)

  if (patchesResult === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const patches = !('error' in patchesResult) ? patchesResult.patches : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Variants ({patches.length})</h3>

        <CreatePatchDialog profileId={profileId}>
          <Button>Create Variant</Button>
        </CreatePatchDialog>
      </div>

      {patches.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 py-12 text-center">
          <p className="mb-4 text-muted-foreground">
            No variants yet. Create your first tailored resume variant.
          </p>

          <CreatePatchDialog profileId={profileId}>
            <Button>Create Variant</Button>
          </CreatePatchDialog>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patches.map((patch) => (
            <PatchCard key={patch._id} patch={patch} />
          ))}
        </div>
      )}
    </div>
  )
}
