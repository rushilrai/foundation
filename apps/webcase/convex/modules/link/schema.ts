import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const linkFields = {
  // Better Auth user id (token subject)
  userId: v.string(),
  // Normalised href (see parseHttpUrl): duplicates are matched on it.
  url: v.string(),
  // Host of the final page, without www.
  domain: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  // Normalised with shared/tags.ts
  tags: v.array(v.string()),
  summary: v.optional(v.string()),
  summaryStatus: v.union(
    v.literal('pending'),
    v.literal('ready'),
    v.literal('failed'),
  ),
  // When the pending summary job is due to run. Spaces out imports and
  // tells a stuck `pending` (long overdue) from a queued one.
  summaryDueAt: v.optional(v.number()),
  // Milliseconds since the epoch
  savedAt: v.number(),
}

export const linkTable = defineTable(linkFields)
  .index('by_user_savedAt', ['userId', 'savedAt'])
  .index('by_user_url', ['userId', 'url'])
  .index('by_user_status_due', ['userId', 'summaryStatus', 'summaryDueAt'])
