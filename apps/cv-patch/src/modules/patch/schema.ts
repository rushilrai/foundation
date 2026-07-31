import type { Doc, Id } from '@convex/_generated/dataModel.js'

export type Patch = Doc<'patches'>
export type PatchId = Id<'patches'>
export type PatchVersion = Doc<'patchVersions'>
export type PatchVersionId = Id<'patchVersions'>
export type PatchVersionWithUrls = PatchVersion & {
  pdfUrl: string | null
  docxUrl: string | null
}
