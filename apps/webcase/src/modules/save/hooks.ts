import type { Doc, Id } from '@convex/_generated/dataModel'
import type { ExistingLink } from '@convex/modules/link/queries'
import { normalizeTags } from '@shared/tags'
import { useState } from 'react'

type SaveDraftInput = {
  /** Normalised href being saved. */
  url: string
  /** The live library, or undefined while it loads. */
  links: readonly Doc<'links'>[] | undefined
  /** What the preview said about this URL, used until the library loads. */
  previewExisting: ExistingLink | null
}

/**
 * The tags being chosen for a link, and the saved link at the same URL if
 * there is one. That link's tags are added to the picker once, so saving
 * replaces them rather than merging. `freeze` keeps the answer as it was
 * when Save was tapped, so the page does not flip to "Already in your
 * library" as the new link arrives in the live list.
 */
export function useSaveDraft({ url, links, previewExisting }: SaveDraftInput) {
  const [tags, setTags] = useState<string[]>([])
  // The saved link whose tags were added to the picker.
  const [seededFrom, setSeededFrom] = useState<Id<'links'> | null>(null)
  const [frozen, setFrozen] = useState<{
    existing: ExistingLink | null
  } | null>(null)

  // The live library is the truth once loaded: a cached preview may predate
  // saving this link. Until then the preview's own answer stands.
  const saved = links?.find((link) => link.url === url)
  const liveExisting: ExistingLink | null = links
    ? saved
      ? { linkId: saved._id, tags: saved.tags }
      : null
    : previewExisting
  const existing = frozen ? frozen.existing : liveExisting

  if (existing && seededFrom !== existing.linkId) {
    setSeededFrom(existing.linkId)
    setTags((current) => normalizeTags([...existing.tags, ...current]))
  }

  return {
    tags,
    setTags,
    existing,
    /** The link whose tags Save replaces: only one the picker started from. */
    replaceId:
      existing && existing.linkId === seededFrom ? existing.linkId : null,
    freeze: () => setFrozen({ existing }),
    unfreeze: () => setFrozen(null),
  }
}
