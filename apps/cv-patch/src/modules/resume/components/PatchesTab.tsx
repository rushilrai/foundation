import { api } from '@convex/_generated/api.js'
import type { Id } from '@convex/_generated/dataModel.js'
import { useQuery } from 'convex/react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { CreatePatchDialog } from '@/modules/patch/components/CreatePatchDialog'
import { PatchCard } from '@/modules/patch/components/PatchCard'

type PatchesTabProps = {
  resumeId: Id<'resumes'>
}

export const PatchesTab = ({ resumeId }: PatchesTabProps) => {
  const patchesResult = useQuery(api.modules.patch.queries.listForResume, {
    resumeId,
  })

  if (patchesResult === undefined) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Variants ({patches.length})</h3>

        <CreatePatchDialog resumeId={resumeId}>
          <Button>Create Variant</Button>
        </CreatePatchDialog>
      </div>

      {patches.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground mb-4">
            No variants yet. Create your first tailored resume variant.
          </p>

          <CreatePatchDialog resumeId={resumeId}>
            <Button>Create Variant</Button>
          </CreatePatchDialog>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patches.map((patch) => (
            <PatchCard key={patch._id} patch={patch} />
          ))}
        </div>
      )}
    </div>
  )
}
