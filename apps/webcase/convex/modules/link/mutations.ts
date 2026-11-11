import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../../_generated/server'
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_DOMAIN_LENGTH,
  MAX_IMPORT_BATCH,
  MAX_TITLE_LENGTH,
} from '../../../shared/limits'
import { normalizeTags } from '../../../shared/tags'
import { rateLimiter } from '../../configs/rateLimiter'
import { cleanImageUrl, domainOf, parseHttpUrl } from '../../lib/metadata/url'
import { capText } from '../../lib/text'
import { getUserId } from '../auth/helpers'
import { getByUrl, getOwned, mergeTags } from './helpers'

// Imported links are enriched one every 1.5 s so a large import doesn't
// burst page fetches and model calls.
const IMPORT_SPACING_MS = 1_500
// Pending summaries due longer ago than this no longer hold up new imports:
// they are stuck, not queued.
const QUEUE_WINDOW_MS = 60 * 60_000
// A pending summary this far past its due time may be retried.
const STUCK_AFTER_MS = 10 * 60_000
// Anything earlier (March 1973) is a timestamp in seconds, not milliseconds.
const MIN_SAVED_AT_MS = 1e11

// When the next imported link's enrichment should run: after the user's
// latest queued one, or now.
const nextImportSlot = async (
  ctx: MutationCtx,
  userId: string,
  now: number,
): Promise<number> => {
  const latest = await ctx.db
    .query('links')
    .withIndex('by_user_status_due', (q) =>
      q
        .eq('userId', userId)
        .eq('summaryStatus', 'pending')
        .gt('summaryDueAt', now - QUEUE_WINDOW_MS),
    )
    .order('desc')
    .first()

  return Math.max(now, (latest?.summaryDueAt ?? 0) + IMPORT_SPACING_MS)
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
    const url = parsed.href
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

    const now = Date.now()
    const linkId = await ctx.db.insert('links', {
      userId,
      url,
      domain:
        capText(args.domain, MAX_DOMAIN_LENGTH)?.toLowerCase() ??
        domainOf(parsed),
      title: capText(args.title, MAX_TITLE_LENGTH) ?? url,
      description: capText(args.description, MAX_DESCRIPTION_LENGTH),
      image: cleanImageUrl(args.image),
      tags,
      summaryStatus: 'pending',
      summaryDueAt: now,
      savedAt: now,
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
  ): Promise<{ success: true } | { error: 'UNAUTHORIZED' | 'NOT_FOUND' }> => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    const link = await getOwned(ctx, userId, args.linkId)
    if (!link) {
      return { error: 'NOT_FOUND' }
    }

    await ctx.db.patch(link._id, { tags: normalizeTags(args.tags) })

    return { success: true }
  },
})

export const remove = mutation({
  args: { linkId: v.id('links') },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: 'UNAUTHORIZED' | 'NOT_FOUND' }> => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    const link = await getOwned(ctx, userId, args.linkId)
    if (!link) {
      return { error: 'NOT_FOUND' }
    }

    await ctx.db.delete(link._id)

    return { success: true }
  },
})

// Runs a `failed` summary again, or a `pending` one that is long overdue.
// Also re-reads the page and fills metadata that is still missing.
export const retrySummary = mutation({
  args: { linkId: v.id('links') },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { success: true }
    | {
        error: 'UNAUTHORIZED' | 'NOT_FOUND' | 'NOT_RETRYABLE' | 'RATE_LIMITED'
      }
  > => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    const link = await getOwned(ctx, userId, args.linkId)
    if (!link) {
      return { error: 'NOT_FOUND' }
    }

    const now = Date.now()
    const queued =
      link.summaryStatus === 'pending' &&
      link.summaryDueAt !== undefined &&
      link.summaryDueAt > now - STUCK_AFTER_MS
    if (link.summaryStatus === 'ready' || queued) {
      return { error: 'NOT_RETRYABLE' }
    }

    const { ok } = await rateLimiter.limit(ctx, 'createLink', { key: userId })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    await ctx.db.patch(link._id, {
      summaryStatus: 'pending',
      summaryDueAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.modules.link.nodeActions.enrich, {
      linkId: link._id,
    })

    return { success: true }
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
        // Milliseconds since the epoch. Pocket's time_added is in seconds:
        // multiply by 1000. Values below 1e11 are rejected as seconds.
        savedAt: v.number(),
      }),
    ),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { imported: number; skipped: number; invalid: number }
    | { error: 'UNAUTHORIZED' | 'TOO_MANY_ITEMS' | 'RATE_LIMITED' }
  > => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    if (args.items.length > MAX_IMPORT_BATCH) {
      return { error: 'TOO_MANY_ITEMS' }
    }

    const now = Date.now()
    const seen = new Set<string>()
    const rows: Array<{
      url: string
      domain: string
      title: string
      tags: Array<string>
      savedAt: number
    }> = []
    let skipped = 0
    let invalid = 0

    for (const item of args.items) {
      const parsed = parseHttpUrl(item.url)
      if (
        !parsed ||
        !Number.isFinite(item.savedAt) ||
        item.savedAt < MIN_SAVED_AT_MS
      ) {
        invalid += 1
        continue
      }

      const url = parsed.href
      if (seen.has(url) || (await getByUrl(ctx, userId, url))) {
        skipped += 1
        continue
      }
      seen.add(url)

      rows.push({
        url,
        domain: domainOf(parsed),
        // A missing title stays the URL until enrichment finds a better one.
        title: capText(item.title, MAX_TITLE_LENGTH) ?? url,
        tags: normalizeTags(item.tags),
        savedAt: Math.min(Math.round(item.savedAt), now),
      })
    }

    if (rows.length === 0) {
      return { imported: 0, skipped, invalid }
    }

    // Charged only for the rows that will be inserted, so re-running a
    // partly finished import costs nothing for the links already in.
    const { ok } = await rateLimiter.limit(ctx, 'importLinks', {
      key: userId,
      count: rows.length,
    })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    let dueAt = await nextImportSlot(ctx, userId, now)

    for (const row of rows) {
      const linkId = await ctx.db.insert('links', {
        userId,
        ...row,
        summaryStatus: 'pending',
        summaryDueAt: dueAt,
      })
      await ctx.scheduler.runAt(
        dueAt,
        internal.modules.link.nodeActions.enrich,
        { linkId },
      )
      dueAt += IMPORT_SPACING_MS
    }

    return { imported: rows.length, skipped, invalid }
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
      summaryDueAt: undefined,
    })
  },
})
