import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import {
  nullableResumeDataValidator,
  resumeDataValidator,
} from '../common/resumeData'

export const patchFields = {
  resumeId: v.id('resumes'),
  userId: v.id('users'),
  title: v.string(),
  jobDescription: v.string(),
  companyName: v.string(),
  roleName: v.string(),
  threadId: v.optional(v.string()),
  activeVersionId: v.optional(v.id('patchVersions')),
  // Set while an agent run is in flight; guards against concurrent runs.
  agentRunningSince: v.optional(v.number()),
  // Legacy field from the pre-agent flow; no longer written.
  streamingText: v.optional(v.nullable(v.string())),
  templateId: v.string(),
  data: nullableResumeDataValidator,
  patchedFileId: v.nullable(v.id('_storage')),
  pdfFileId: v.nullable(v.id('_storage')),
  changes: v.nullable(v.array(v.string())),
  coverLetter: v.optional(
    v.object({
      greeting: v.string(),
      paragraphs: v.array(v.string()),
      fileId: v.id('_storage'),
      pdfFileId: v.nullable(v.id('_storage')),
      generatedAt: v.number(),
    }),
  ),
  status: v.union(
    v.literal('generating'),
    v.literal('ready'),
    v.literal('error'),
  ),
  errorMessage: v.optional(v.string()),
  deleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}

export const patchTable = defineTable(patchFields)
  .index('by_resumeId', ['resumeId'])
  .index('by_userId', ['userId'])
  .index('by_resumeId_deleted', ['resumeId', 'deleted'])
  .index('by_userId_deleted', ['userId', 'deleted'])
  .index('by_threadId', ['threadId'])

export const patchVersionFields = {
  patchId: v.id('patches'),
  userId: v.id('users'),
  versionNumber: v.number(),
  data: resumeDataValidator,
  changes: v.array(v.string()),
  patchedFileId: v.id('_storage'),
  pdfFileId: v.nullable(v.id('_storage')),
  pageCount: v.nullable(v.number()),
  createdAt: v.number(),
}

export const patchVersionTable = defineTable(patchVersionFields).index(
  'by_patchId',
  ['patchId'],
)
