import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { internalMutation, mutation } from '../../_generated/server'
import { rateLimiter } from '../../configs/rateLimiter'
import { domainOf, parseHttpUrl } from '../../lib/metadata/url'
import { getUserId } from '../auth/helpers'
import {
  capText,
  getByUrl,
  getOwned,
  MAX_DESCRIPTION_LENGTH,
  MAX_DOMAIN_LENGTH,
  MAX_IMAGE_URL_LENGTH,
  MAX_TITLE_LENGTH,
  mergeTags,
  normalizeTags,
} from './helpers'

const MAX_IMPORT_BATCH = 100
// Imported links are enriched one every 1.5 s so a large import doesn't
// burst page fetches and model calls.
const ENRICH_SPACING_MS = 1_500

const cleanImage = (image: string | undefined): string | undefined => {
  const url = image ? parseHttpUrl(image) : null

  return url && url.href.length <= MAX_IMAGE_URL_LENGTH ? url.href : undefined
}

export const create = mutation({
  args: {
    url: v.string(),
    title: v.string(),
    domain: v.string(),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { linkId: Id<'links'>; duplicate: boolean }
    | { error: 'UNAUTHORIZED' | 'INVALID_URL' | 'RATE_LIMITED' }
  > => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    const parsed = parseHttpUrl(args.url)
    if (!parsed) {
      return { error: 'INVALID_URL' }
    }
    // Stored as the user saved it, minus surrounding whitespace.
    const url = args.url.trim()
    const tags = normalizeTags(args.tags)

    const existing = await getByUrl(ctx, userId, url)
    if (existing) {
      const merged = mergeTags(existing.tags, tags)
      if (merged.length !== existing.tags.length) {
        await ctx.db.patch(existing._id, { tags: merged })
      }
      return { linkId: existing._id, duplicate: true }
    }

    const { ok } = await rateLimiter.limit(ctx, 'createLink', { key: userId })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    const linkId = await ctx.db.insert('links', {
      userId,
      url,
      domain:
        capText(args.domain, MAX_DOMAIN_LENGTH)?.toLowerCase() ??
        domainOf(parsed),
      title: capText(args.title, MAX_TITLE_LENGTH) ?? url,
      description: capText(args.description, MAX_DESCRIPTION_LENGTH),
      image: cleanImage(args.image),
      tags,
      summaryStatus: 'pending',
      savedAt: Date.now(),
    })

    await ctx.scheduler.runAfter(
      0,
      internal.modules.link.nodeActions.summarize,
      { linkId },
    )

    return { linkId, duplicate: false }
  },
})

export const updateTags = mutation({
  args: { linkId: v.id('links'), tags: v.array(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true } | { error: 'UNAUTHORIZED' | 'NOT_FOUND' }> => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    const link = await getOwned(ctx, userId, args.linkId)
    if (!link) {
      return { error: 'NOT_FOUND' }
    }

    await ctx.db.patch(link._id, { tags: normalizeTags(args.tags) })

    return { ok: true }
  },
})

export const remove = mutation({
  args: { linkId: v.id('links') },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true } | { error: 'UNAUTHORIZED' | 'NOT_FOUND' }> => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    const link = await getOwned(ctx, userId, args.linkId)
    if (!link) {
      return { error: 'NOT_FOUND' }
    }

    await ctx.db.delete(link._id)

    return { ok: true }
  },
})

// One batch of a Pocket export, parsed by the client.
export const importMany = mutation({
  args: {
    items: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        tags: v.array(v.string()),
        // Milliseconds
        savedAt: v.number(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { imported: number; skipped: number }
    | { error: 'UNAUTHORIZED' | 'TOO_MANY_ITEMS' | 'RATE_LIMITED' }
  > => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    if (args.items.length > MAX_IMPORT_BATCH) {
      return { error: 'TOO_MANY_ITEMS' }
    }
    if (args.items.length === 0) {
      return { imported: 0, skipped: 0 }
    }

    const { ok } = await rateLimiter.limit(ctx, 'importLinks', {
      key: userId,
      count: args.items.length,
    })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    // Start after the links already waiting for enrichment or a summary.
    const pending = await ctx.db
      .query('links')
      .withIndex('by_user_savedAt', (q) => q.eq('userId', userId))
      .filter((q) => q.eq(q.field('summaryStatus'), 'pending'))
      .collect()

    const seen = new Set<string>()
    const now = Date.now()
    let imported = 0
    let skipped = 0

    for (const item of args.items) {
      const parsed = parseHttpUrl(item.url)
      const url = item.url.trim()
      if (!parsed || seen.has(url) || (await getByUrl(ctx, userId, url))) {
        skipped += 1
        continue
      }
      seen.add(url)

      const linkId = await ctx.db.insert('links', {
        userId,
        url,
        domain: domainOf(parsed),
        // A missing title stays the URL until enrichment finds a better one.
        title: capText(item.title, MAX_TITLE_LENGTH) ?? url,
        tags: normalizeTags(item.tags),
        summaryStatus: 'pending',
        savedAt:
          Number.isFinite(item.savedAt) && item.savedAt > 0
            ? Math.min(Math.round(item.savedAt), now)
            : now,
      })

      await ctx.scheduler.runAfter(
        (pending.length + imported) * ENRICH_SPACING_MS,
        internal.modules.link.nodeActions.enrich,
        { linkId },
      )
      imported += 1
    }

    return { imported, skipped }
  },
})

// Fills in what enrichment found. Only empty fields are filled, except the
// title, which the caller decides on.
export const applyMetadataInternal = internalMutation({
  args: {
    linkId: v.id('links'),
    domain: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const link = await ctx.db.get(args.linkId)
    if (!link) {
      return
    }

    await ctx.db.patch(link._id, {
      ...(args.domain ? { domain: args.domain } : {}),
      ...(args.title ? { title: args.title } : {}),
      ...(!link.description && args.description
        ? { description: args.description }
        : {}),
      ...(!link.image && args.image ? { image: args.image } : {}),
    })
  },
})

export const setSummaryInternal = internalMutation({
  args: {
    linkId: v.id('links'),
    summary: v.optional(v.string()),
    summaryStatus: v.union(v.literal('ready'), v.literal('failed')),
  },
  handler: async (ctx, args): Promise<void> => {
    const link = await ctx.db.get(args.linkId)
    if (!link) {
      return
    }

    await ctx.db.patch(link._id, {
      summary: args.summary,
      summaryStatus: args.summaryStatus,
    })
  },
})
