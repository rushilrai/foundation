import { v } from 'convex/values'

import type { Doc, Id } from '../../_generated/dataModel'
import { internalQuery, query } from '../../_generated/server'
import type { TagCount } from '../../../shared/tags'
import { getUserId } from '../auth/helpers'
import { getByUrl, getUserLinks } from './helpers'

// The whole library at once: search and tag filters run in the browser.
export const list = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ links: Array<Doc<'links'>> } | { error: 'UNAUTHORIZED' }> => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    return { links: await getUserLinks(ctx, userId) }
  },
})

export const getInternal = internalQuery({
  args: { linkId: v.id('links') },
  handler: async (ctx, args): Promise<Doc<'links'> | null> =>
    await ctx.db.get(args.linkId),
})

export type ExistingLink = { linkId: Id<'links'>; tags: Array<string> }

// The user's link at this (normalised) URL, if they saved it already.
export const getExistingInternal = internalQuery({
  args: { userId: v.string(), url: v.string() },
  handler: async (ctx, args): Promise<ExistingLink | null> => {
    const link = await getByUrl(ctx, args.userId, args.url)

    return link ? { linkId: link._id, tags: link.tags } : null
  },
})

export type TagStat = TagCount & {
  // A few titles of links that carry the tag, newest first
  examples: Array<string>
}

const MAX_TAG_EXAMPLES = 3

// The user's tags, most used first, with example titles so a model can
// learn what the user means by each one.
export const tagStatsInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<Array<TagStat>> => {
    const stats = new Map<string, TagStat>()

    for (const link of await getUserLinks(ctx, args.userId)) {
      for (const tag of link.tags) {
        const stat = stats.get(tag) ?? { tag, count: 0, examples: [] }
        stat.count += 1
        if (stat.examples.length < MAX_TAG_EXAMPLES) {
          stat.examples.push(link.title.slice(0, 100))
        }
        stats.set(tag, stat)
      }
    }

    return [...stats.values()].sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
    )
  },
})

export type AskEntry = {
  _id: Id<'links'>
  title: string
  domain: string
  tags: Array<string>
  summary?: string
  description?: string
}

// Just the fields the ask prompt uses, newest first.
export const askEntriesInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<Array<AskEntry>> =>
    (await getUserLinks(ctx, args.userId)).map((link) => ({
      _id: link._id,
      title: link.title,
      domain: link.domain,
      tags: link.tags,
      summary: link.summary,
      description: link.description,
    })),
})
