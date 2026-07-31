import type { ResumeData } from '@shared/resumeSchema'
import { useState } from 'react'

import { cn } from '@/components/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRestorePatchVersion } from '@/modules/patch/mutations'
import { usePatchVersions } from '@/modules/patch/queries'
import type {
  Patch,
  PatchVersionId,
  PatchVersionWithUrls,
} from '@/modules/patch/schema'
import { useResume } from '@/modules/resume/queries'
import { PatchDiff } from './PatchDiff'

type PatchVersionsProps = {
  patch: Patch
}

export const PatchVersions = ({ patch }: PatchVersionsProps) => {
  const versionsResult = usePatchVersions(patch._id)
  const resumeResult = useResume(patch.resumeId)
  const restoreVersion = useRestorePatchVersion()
  const [restoringId, setRestoringId] = useState<PatchVersionId | null>(null)
  const [toggledId, setToggledId] = useState<PatchVersionId | 'none' | null>(
    null,
  )

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

  const baseData =
    resumeResult !== undefined && 'resume' in resumeResult
      ? resumeResult.resume.data
      : null

  // Latest stays expanded until the user explicitly toggles something.
  const expandedId = toggledId ?? versions[0]._id

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
      {versions.map((version) => (
        <VersionItem
          key={version._id}
          version={version}
          isActive={patch.activeVersionId === version._id}
          isExpanded={expandedId === version._id}
          isRestoring={restoringId === version._id}
          restoreDisabled={restoringId !== null}
          baseData={baseData}
          onToggle={() =>
            setToggledId(expandedId === version._id ? 'none' : version._id)
          }
          onRestore={() => handleRestore(version._id)}
        />
      ))}
    </div>
  )
}

type VersionItemProps = {
  version: PatchVersionWithUrls
  isActive: boolean
  isExpanded: boolean
  isRestoring: boolean
  restoreDisabled: boolean
  baseData: ResumeData | null
  onToggle: () => void
  onRestore: () => void
}

const VersionItem = ({
  version,
  isActive,
  isExpanded,
  isRestoring,
  restoreDisabled,
  baseData,
  onToggle,
  onRestore,
}: VersionItemProps) => {
  return (
    <div className="rounded-lg border">
      <div
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start justify-between gap-4 p-3 text-left"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              Version {version.versionNumber}
            </p>
            {isActive && <Badge variant="secondary">Active</Badge>}
            <span
              className={cn(
                'text-xs text-muted-foreground transition-transform',
                isExpanded && 'rotate-90',
              )}
            >
              ›
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {new Date(version.createdAt).toLocaleString()}
          </p>

          {!isExpanded && version.changes.length > 0 && (
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

        <span className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isActive || restoreDisabled}
            onClick={(e) => {
              e.stopPropagation()
              onRestore()
            }}
          >
            {isRestoring ? 'Restoring...' : 'Restore'}
          </Button>
        </span>
      </div>

      {isExpanded && (
        <div className="space-y-4 border-t p-3">
          {version.pdfUrl ? (
            <iframe
              src={version.pdfUrl}
              title={`Version ${version.versionNumber} preview`}
              className="h-[480px] w-full rounded-md border bg-muted"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-md bg-muted">
              <p className="px-6 text-center text-xs text-muted-foreground">
                PDF preview is unavailable for this version — the DOCX download
                still works.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            {version.docxUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(version.docxUrl ?? '', '_blank')}
              >
                Download DOCX
              </Button>
            )}
            {version.pageCount !== null && (
              <p className="text-xs text-muted-foreground">
                {version.pageCount} page{version.pageCount === 1 ? '' : 's'}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium">Changes</p>
            {baseData ? (
              <PatchDiff base={baseData} patched={version.data} />
            ) : (
              <p className="text-xs text-muted-foreground">
                Base resume unavailable — cannot compute changes.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
