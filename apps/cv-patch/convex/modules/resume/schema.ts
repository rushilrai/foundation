import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import { nullableResumeDataValidator } from '../common/resumeData'

export const resumeFields = {
  userId: v.id('users'),
  title: v.string(),
  fileId: v.id('_storage'),
  pdfFileId: v.nullable(v.id('_storage')),
  fileName: v.string(),
  fileSize: v.number(),
  templateId: v.string(),
  data: nullableResumeDataValidator,
  rawText: v.string(),
  status: v.union(
    v.literal('processing'),
    v.literal('ready'),
    v.literal('error'),
  ),
  errorMessage: v.optional(v.string()),
  deleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}

export const resumeTable = defineTable(resumeFields)
  .index('by_userId', ['userId'])
  .index('by_userId_deleted', ['userId', 'deleted'])
  .index('by_fileId', ['fileId'])
