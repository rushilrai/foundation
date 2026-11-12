import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../../_generated/server'
import {
  IMPORT_SPACING_MS,
  MAX_DESCRIPTION_LENGTH,
  MAX_DOMAIN_LENGTH,
  MAX_IMPORT_BATCH,
  MAX_LINKS_PER_USER,
  MAX_TITLE_LENGTH,
  SUMMARY_STUCK_AFTER_MS,
} from '../../../shared/limits'
import { normalizeTags } from '../../../shared/tags'
import {
  domainOf,
  fallbackTitle,
  isPlaceholderTitle,
  parseHttpUrl,
} from '../../../shared/url'
import { rateLimiter } from '../../configs/rateLimiter'
import { cleanImageUrl } from '../../lib/metadata/url'
import { capText } from '../../lib/text'
import { getUserId } from '../auth/helpers'
import {
  changeLinkCount,
  countLinks,
  getByUrl,
  getOwned,
  getUserLinks,
  mergeTags,
  reenrichReasons,
} from './helpers'

// Pending summaries due longer ago than this no longer hold up new imports:
// they are stuck, not queued.
const QUEUE_WINDOW_MS = 60 * 60_000
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
    | {
        error: 'UNAUTHORIZED' | 'INVALID_URL' | 'RATE_LIMITED' | 'LIBRARY_FULL'
      }
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

    if ((await countLinks(ctx, userId)) >= MAX_LINKS_PER_USER) {
      return { error: 'LIBRARY_FULL' }
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
      title: capText(args.title, MAX_TITLE_LENGTH) ?? fallbackTitle(parsed),
      description: capText(args.description, MAX_DESCRIPTION_LENGTH),
      image: cleanImageUrl(args.image),
      tags,
      summaryStatus: 'pending',
      summaryDueAt: now,
      savedAt: now,
    })
    await changeLinkCount(ctx, userId, 1)

    // Also fills the title, description and image when the link was saved
    // before its preview arrived.
    await ctx.scheduler.runAfter(0, internal.modules.link.nodeActions.enrich, {
      linkId,
    })

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
    await changeLinkCount(ctx, userId, -1)

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
      link.summaryDueAt > now - SUMMARY_STUCK_AFTER_MS
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

// One batch of a Pocket export, parsed by the client. New rows go in until
// the library holds MAX_LINKS_PER_USER; `full` counts the ones left out.
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
    | { imported: number; skipped: number; invalid: number; full: number }
    | {
        error:
          'UNAUTHORIZED' | 'TOO_MANY_ITEMS' | 'RATE_LIMITED' | 'LIBRARY_FULL'
      }
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

      // Pocket often stored the URL itself as the title. Until enrichment
      // finds a real one, host and path read better.
      const title = capText(item.title, MAX_TITLE_LENGTH)
      rows.push({
        url,
        domain: domainOf(parsed),
        title:
          title && !isPlaceholderTitle(title, item.url)
            ? title
            : fallbackTitle(parsed),
        tags: normalizeTags(item.tags),
        savedAt: Math.min(Math.round(item.savedAt), now),
      })
    }

    if (rows.length === 0) {
      return { imported: 0, skipped, invalid, full: 0 }
    }

    const room = MAX_LINKS_PER_USER - (await countLinks(ctx, userId))
    if (room <= 0) {
      return { error: 'LIBRARY_FULL' }
    }
    const inserted = rows.slice(0, room)
    const full = rows.length - inserted.length

    // Charged only for the rows that will be inserted, so re-running a
    // partly finished import costs nothing for the links already in.
    const { ok } = await rateLimiter.limit(ctx, 'importLinks', {
      key: userId,
      count: inserted.length,
    })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    let dueAt = await nextImportSlot(ctx, userId, now)

    for (const row of inserted) {
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
    await changeLinkCount(ctx, userId, inserted.length)

    return { imported: inserted.length, skipped, invalid, full }
  },
})

// Most links one reenrichInternal call schedules; run it again for the
// rest (links already queued are skipped).
const MAX_REENRICH_BATCH = 500

// Operator tool, not public: refreshes the metadata of links saved before
// the site resolvers (lib/metadata/sites) existed. Selects the user's links
// on those sites that still lack what their site provides, and any link
// whose title is a stand-in or carries Reddit's prefix (see
// reenrichReasons), optionally only on `domains`, and schedules `enrich`
// for each with `refresh`, spaced like an import. A refresh never replaces
// a real title and writes a new summary only when the title or description
// changed; summaries count against the global summary budget as always.
// `dryRun` lists what would be touched and changes nothing. Run with
// `bunx convex run modules/link/mutations:reenrichInternal`, see AGENTS.md.
export const reenrichInternal = internalMutation({
  args: {
    userId: v.string(),
    domains: v.optional(v.array(v.string())),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | {
        dryRun: true
        selected: number
        links: Array<{
          linkId: Id<'links'>
          url: string
          title: string
          reasons: Array<string>
        }>
      }
    | { dryRun: false; scheduled: number; remaining: number }
  > => {
    const now = Date.now()
    const domains = (args.domains ?? [])
      .map((domain) =>
        domain
          .trim()
          .toLowerCase()
          .replace(/^www\./, ''),
      )
      .filter(Boolean)
    const onDomains = (hosts: Array<string>): boolean =>
      domains.length === 0 ||
      hosts.some((host) =>
        domains.some(
          (domain) => host === domain || host.endsWith(`.${domain}`),
        ),
      )

    const selected = []
    // The latest queued run, so this batch starts after an earlier one.
    let latestDue = 0
    for (const link of await getUserLinks(ctx, args.userId)) {
      // A queued summary (an import, or an earlier refresh) reads the link
      // anyway.
      const queued =
        link.summaryDueAt !== undefined &&
        link.summaryDueAt > now - SUMMARY_STUCK_AFTER_MS
      if (queued) {
        latestDue = Math.max(latestDue, link.summaryDueAt ?? 0)
      }
      const parsed = parseHttpUrl(link.url)
      if (queued || !parsed || !onDomains([domainOf(parsed), link.domain])) {
        continue
      }

      const reasons = reenrichReasons(link, parsed)
      if (reasons.length > 0) {
        selected.push({ link, reasons })
      }
    }

    if (args.dryRun) {
      return {
        dryRun: true,
        selected: selected.length,
        links: selected.map(({ link, reasons }) => ({
          linkId: link._id,
          url: link.url,
          title: link.title,
          reasons,
        })),
      }
    }

    const batch = selected.slice(0, MAX_REENRICH_BATCH)
    let dueAt = Math.max(
      await nextImportSlot(ctx, args.userId, now),
      latestDue + IMPORT_SPACING_MS,
    )
    for (const { link } of batch) {
      // The due time marks the link as queued, so a second call doesn't
      // schedule it twice; setSummaryInternal clears it. A `ready` link
      // stays ready and keeps showing its summary meanwhile.
      await ctx.db.patch(link._id, { summaryDueAt: dueAt })
      await ctx.scheduler.runAt(
        dueAt,
        internal.modules.link.nodeActions.enrich,
        { linkId: link._id, refresh: true },
      )
      dueAt += IMPORT_SPACING_MS
    }

    return {
      dryRun: false,
      scheduled: batch.length,
      remaining: selected.length - batch.length,
    }
  },
})

// Fills in what enrichment found. Only empty fields are filled, except the
// title, which the caller decides on, and the description when
// `replaceDescription` (Reddit's generic one is replaced, or cleared when
// nothing better was read). `changed`: whether the title or description,
// what a summary reads, changed.
export const applyMetadataInternal = internalMutation({
  args: {
    linkId: v.id('links'),
    domain: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    image: v.optional(v.string()),
    replaceDescription: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{ changed: boolean }> => {
    const link = await ctx.db.get(args.linkId)
    if (!link) {
      return { changed: false }
    }

    const description = args.replaceDescription
      ? args.description
      : (link.description ?? args.description)
    const patch = {
      ...(args.domain ? { domain: args.domain } : {}),
      ...(args.title ? { title: args.title } : {}),
      ...(description !== link.description ? { description } : {}),
      ...(!link.image && args.image ? { image: args.image } : {}),
    }
    await ctx.db.patch(link._id, patch)

    return {
      changed:
        (patch.title !== undefined && patch.title !== link.title) ||
        'description' in patch,
    }
  },
})

// Puts a summary back in the queue for `dueAt`, when the global summary
// budget is spent. The link stays `pending`; retrySummary treats it as
// queued until it is overdue.
export const deferSummaryInternal = internalMutation({
  args: { linkId: v.id('links'), dueAt: v.number(), attempt: v.number() },
  handler: async (ctx, args): Promise<void> => {
    const link = await ctx.db.get(args.linkId)
    if (!link) {
      return
    }

    await ctx.db.patch(link._id, { summaryDueAt: args.dueAt })
    await ctx.scheduler.runAt(
      args.dueAt,
      internal.modules.link.nodeActions.enrich,
      { linkId: link._id, attempt: args.attempt },
    )
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
