import { defineTable } from 'convex/server'
import { v } from 'convex/values'

export const linkFields = {
  // Better Auth user id (token subject)
  userId: v.string(),
  // As the user saved it
  url: v.string(),
  // Host of the final page, without www.
  domain: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  image: v.optional(v.string()),
  // Lowercase, trimmed
  tags: v.array(v.string()),
  summary: v.optional(v.string()),
  summaryStatus: v.union(
    v.literal('pending'),
    v.literal('ready'),
    v.literal('failed'),
  ),
  savedAt: v.number(),
}

export const linkTable = defineTable(linkFields)
  .index('by_user_savedAt', ['userId', 'savedAt'])
  .index('by_user_url', ['userId', 'url'])
