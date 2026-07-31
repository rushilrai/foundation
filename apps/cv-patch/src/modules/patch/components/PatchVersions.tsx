import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRestorePatchVersion } from '@/modules/patch/mutations'
import { usePatchVersions } from '@/modules/patch/queries'
import type { Patch, PatchVersionId } from '@/modules/patch/schema'

type PatchVersionsProps = {
  patch: Patch
}

export const PatchVersions = ({ patch }: PatchVersionsProps) => {
  const versionsResult = usePatchVersions(patch._id)
  const restoreVersion = useRestorePatchVersion()
  const [restoringId, setRestoringId] = useState<PatchVersionId | null>(null)

  if (versionsResult === undefined) {
    return <Skeleton className="h-24 w-full" />
  }

  if ('error' in versionsResult) {
    return <p className="text-sm text-destructive">Failed to load versions.</p>
  }

  const { versions } = versionsResult

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No versions yet. They appear every time the agent updates the resume.
      </p>
    )
  }

  const handleRestore = async (versionId: PatchVersionId) => {
    setRestoringId(versionId)
    try {
      await restoreVersion({ patchId: patch._id, versionId })
    } catch (error) {
      console.error('Failed to restore version', error)
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <div className="space-y-3">
      {versions.map((version) => {
        const isActive = patch.activeVersionId === version._id

        return (
          <div
            key={version._id}
            className="flex items-start justify-between gap-4 rounded-lg border p-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  Version {version.versionNumber}
                </p>
                {isActive && <Badge variant="secondary">Active</Badge>}
              </div>

              <p className="text-xs text-muted-foreground">
                {new Date(version.createdAt).toLocaleString()}
              </p>

              {version.changes.length > 0 && (
                <ul className="space-y-0.5">
                  {version.changes.slice(0, 3).map((change, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      • {change}
                    </li>
                  ))}
                  {version.changes.length > 3 && (
                    <li className="text-xs text-muted-foreground">
                      …and {version.changes.length - 3} more
                    </li>
                  )}
                </ul>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestore(version._id)}
              disabled={isActive || restoringId !== null}
            >
              {restoringId === version._id ? 'Restoring...' : 'Restore'}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
