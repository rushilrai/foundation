import { defineTable } from 'convex/server'
import { v } from 'convex/values'

import { profileDataValidator } from '../common/profileData'
import { ratingValidator } from '../common/rating'

export const profileFields = {
  userId: v.id('users'),
  title: v.string(),
  threadId: v.optional(v.string()),
  // Set while the builder agent is running; treated as stale after 10 minutes.
  agentRunningSince: v.optional(v.number()),
  data: profileDataValidator,
  deleted: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
}

export const profileTable = defineTable(profileFields)
  .index('by_userId', ['userId'])
  .index('by_userId_deleted', ['userId', 'deleted'])
  .index('by_threadId', ['threadId'])

export const documentFields = {
  userId: v.id('users'),
  profileId: v.id('profiles'),
  kind: v.union(
    v.literal('resume'),
    v.literal('coverLetter'),
    v.literal('other'),
  ),
  title: v.string(),
  fileId: v.id('_storage'),
  pdfFileId: v.nullable(v.id('_storage')),
  fileName: v.string(),
  fileSize: v.number(),
  rawText: v.string(),
  rating: v.optional(ratingValidator),
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

export const documentTable = defineTable(documentFields)
  .index('by_profileId', ['profileId'])
  .index('by_profileId_deleted', ['profileId', 'deleted'])
  .index('by_userId', ['userId'])
  .index('by_fileId', ['fileId'])
