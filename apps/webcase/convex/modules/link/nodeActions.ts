'use node'

import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { action, internalAction, type ActionCtx } from '../../_generated/server'
import { MAX_QUESTION_LENGTH } from '../../../shared/limits'
import {
  domainOf,
  fallbackTitle,
  isRewrittenUrl,
  parseHttpUrl,
} from '../../../shared/url'
import { rateLimiter } from '../../configs/rateLimiter'
import { readLink } from '../../lib/metadata/read'
import { getUserId } from '../auth/helpers'
import { answerQuestion, suggestTags, summarizePage } from './ai'
import {
  hasGenericDescription,
  isReplaceableTitle,
  undecoratedTitle,
} from './helpers'
import type { ExistingLink } from './queries'

// Every action in this module runs in the Node runtime: page fetches pin
// DNS answers through node:http(s), and the AI SDK calls need Node too.

// A page's own title, unless it is just a link (Reddit's redirect pages
// give their URL as og:title), which reads no better than host and path.
const pageTitle = (title: string | undefined): string | undefined =>
  title && !parseHttpUrl(title) ? title : undefined

export type LinkPreview = {
  // Normalised; pass it to `create` as is.
  url: string
  domain: string
  title: string
  description?: string
  image?: string
  suggestedTags: Array<string>
  // False when neither the page nor its site rule (lib/metadata/sites)
  // could read anything, or the global preview
  // budget is spent: the fields come from the URL alone.
  fetched: boolean
  // The user's saved link at this URL, or null when it is new.
  existing: ExistingLink | null
}

// What the save page shows before saving. Always succeeds for a valid
// http(s) URL within the user's own limit: when the page can't be fetched
// (or may not be, e.g. a private address) it falls back to the URL's host
// and path, with `fetched: false` and no suggestions.
export const preview = action({
  args: { url: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { preview: LinkPreview }
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

    const { ok } = await rateLimiter.limit(ctx, 'preview', { key: userId })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    const existing = await ctx.runQuery(
      internal.modules.link.queries.getExistingInternal,
      { userId, url },
    )
    // An unread page is shown under the saved URL's own host: where a
    // failed fetch was redirected to (a bot check) says nothing about it.
    const fallback = (): { preview: LinkPreview } => ({
      preview: {
        url,
        domain: domainOf(parsed),
        title: fallbackTitle(parsed),
        suggestedTags: [],
        fetched: false,
        existing,
      },
    })

    // Over the global budget the sheet still works, from the URL alone.
    const global = await rateLimiter.limit(ctx, 'previewGlobal')
    if (!global.ok) {
      console.warn('[preview] Global preview budget spent')
      return fallback()
    }

    const [read, tagStats] = await Promise.all([
      readLink(parsed),
      ctx.runQuery(internal.modules.link.queries.tagStatsInternal, { userId }),
    ])

    if (!('link' in read)) {
      console.log('[preview] Page not read', { error: read.error })
      return fallback()
    }

    const { domain, metadata } = read.link
    const title = pageTitle(metadata.title) ?? fallbackTitle(parsed)

    // Only worth asking when the page told us something beyond its URL.
    const suggestions =
      pageTitle(metadata.title) || metadata.description
        ? await suggestTags(
            { url, domain, title, description: metadata.description },
            tagStats,
            userId,
          )
        : []

    return {
      preview: {
        url,
        domain,
        title,
        description: metadata.description,
        image: metadata.image,
        suggestedTags: suggestions.map(({ tag }) => tag),
        fetched: true,
        existing,
      },
    }
  },
})

// A natural-language question over the caller's library.
export const ask = action({
  args: { question: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { answer: string; linkIds: Array<Id<'links'>> }
    | {
        error:
          | 'UNAUTHORIZED'
          | 'INVALID_QUESTION'
          | 'RATE_LIMITED'
          | 'AI_UNAVAILABLE'
      }
  > => {
    const userId = await getUserId(ctx)
    if (!userId) {
      return { error: 'UNAUTHORIZED' }
    }

    const question = args.question.replace(/\s+/g, ' ').trim()
    if (!question || question.length > MAX_QUESTION_LENGTH) {
      return { error: 'INVALID_QUESTION' }
    }

    // Before the library is read: reading it is the expensive part.
    const { ok } = await rateLimiter.limit(ctx, 'ask', { key: userId })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    const entries = await ctx.runQuery(
      internal.modules.link.queries.askEntriesInternal,
      { userId },
    )
    if (entries.length === 0) {
      return { answer: "You haven't saved any links yet.", linkIds: [] }
    }

    const global = await rateLimiter.limit(ctx, 'askGlobal')
    if (!global.ok) {
      console.warn('[ask] Global ask budget spent')
      return { error: 'RATE_LIMITED' }
    }

    const result = await answerQuestion(question, entries, userId)

    return result ?? { error: 'AI_UNAVAILABLE' }
  },
})

// ---------------------------------------------------------------------------
// Summaries. Every run ends with the link `ready` or `failed` (unless the
// link was deleted meanwhile), or, while the global summary budget is spent,
// queued again for later; a `failed` one can be redone with
// mutations.retrySummary.

// Times a summary waits for the global budget before it is marked failed.
const MAX_SUMMARY_DEFERRALS = 5
// The shortest wait, doubled on each deferral: about 1, 2, 4, 8 and 16
// minutes, so a spent budget is retried for half an hour or so.
const MIN_SUMMARY_DEFERRAL_MS = 60_000

const markFailed = async (
  ctx: ActionCtx,
  linkId: Id<'links'>,
): Promise<void> => {
  try {
    await ctx.runMutation(internal.modules.link.mutations.setSummaryInternal, {
      linkId,
      summaryStatus: 'failed',
    })
  } catch (error) {
    // Left `pending`; retrySummary treats it as stuck once it is overdue.
    console.error('[summary] Could not mark failed', error)
  }
}

// Queues the summary again for after the global budget refills, with
// jitter so deferred links don't all come back at once. Gives up (failed)
// after MAX_SUMMARY_DEFERRALS.
const deferSummary = async (
  ctx: ActionCtx,
  linkId: Id<'links'>,
  attempt: number,
  retryAfter: number | undefined,
): Promise<void> => {
  if (attempt >= MAX_SUMMARY_DEFERRALS) {
    console.warn('[summary] Global summary budget still spent; giving up')
    await markFailed(ctx, linkId)
    return
  }

  const wait = Math.max(retryAfter ?? 0, MIN_SUMMARY_DEFERRAL_MS * 2 ** attempt)
  const dueAt = Date.now() + Math.round(wait * (1 + Math.random() / 2))
  console.warn('[summary] Global summary budget spent; deferred', {
    attempt: attempt + 1,
    dueAt,
  })
  await ctx.runMutation(internal.modules.link.mutations.deferSummaryInternal, {
    linkId,
    dueAt,
    attempt: attempt + 1,
  })
}

// Reads the link (readLink: its site rule, then the page), fills what the
// link is still missing (a replaceable title, the description, the image,
// its site's generic description), stores a redirect wrapper saved before
// wrappers were unwrapped under its destination, then writes the
// summary. A real title is never replaced. The model call is what the
// global summary budget pays for, so only it waits when the budget is
// spent; the metadata fills in regardless. `attempt` counts the waits so
// far. A `refresh` (re-enrichment of a link that already has its summary)
// writes a new summary only when the title or description changed.
const runSummary = async (
  ctx: ActionCtx,
  linkId: Id<'links'>,
  attempt: number,
  refresh: boolean,
): Promise<void> => {
  let link = await ctx.runQuery(internal.modules.link.queries.getInternal, {
    linkId,
  })
  if (!link) {
    return
  }

  // A deferred run already filled the metadata: while the budget is still
  // spent there is nothing to fetch the page again for.
  if (attempt > 0) {
    const status = await rateLimiter.check(ctx, 'summaryGlobal')
    if (!status.ok) {
      await deferSummary(ctx, linkId, attempt, status.retryAfter)
      return
    }
  }

  const parsed = parseHttpUrl(link.url)
  const result = parsed ? await readLink(parsed) : null
  const read = result && 'link' in result ? result.link : undefined
  // A decorated title keeps its own words without the decoration (it is
  // the user's title); a stand-in takes the page's own, else at least the
  // fallback title in place of a raw URL (Pocket often saved the URL as
  // the title).
  const fallback = parsed ? fallbackTitle(parsed) : undefined
  const title =
    parsed && isReplaceableTitle(link.title, link.url, parsed)
      ? undecoratedTitle(link.title, parsed) ||
        pageTitle(read?.metadata.title) ||
        (link.title !== fallback ? fallback : undefined)
      : undefined
  const replaceDescription =
    !!parsed && hasGenericDescription(link.description, parsed)
  const url = parsed && isRewrittenUrl(link.url) ? parsed.href : undefined

  // When the link was read, its final host (or its site's own domain) is
  // where the link lives (a Maps short link is Google's), and what was
  // read fills the gaps. When it was not, the saved URL's own host stays.
  const { changed } =
    read || title || replaceDescription || url
      ? await ctx.runMutation(
          internal.modules.link.mutations.applyMetadataInternal,
          {
            linkId,
            url,
            domain: read?.domain,
            title,
            description: read?.metadata.description,
            image: read?.metadata.image,
            replaceDescription,
          },
        )
      : { changed: false }

  if (refresh && !changed && link.summary) {
    // Nothing the summary reads is new: keep it, and clear the queue mark.
    await ctx.runMutation(internal.modules.link.mutations.setSummaryInternal, {
      linkId,
      summary: link.summary,
      summaryStatus: link.summaryStatus === 'failed' ? 'failed' : 'ready',
    })
    return
  }

  const global = await rateLimiter.limit(ctx, 'summaryGlobal')
  if (!global.ok) {
    await deferSummary(ctx, linkId, attempt, global.retryAfter)
    return
  }

  link =
    (await ctx.runQuery(internal.modules.link.queries.getInternal, {
      linkId,
    })) ?? link

  const metadata = read?.metadata
  const summary = await summarizePage(
    {
      url: link.url,
      domain: link.domain,
      title: link.title,
      pageTitle: metadata?.title,
      description: link.description ?? metadata?.description,
      text: metadata?.text,
    },
    link.userId,
  )

  // A refresh whose model call failed keeps the summary the link had.
  const kept = refresh && !summary ? link.summary : undefined
  await ctx.runMutation(internal.modules.link.mutations.setSummaryInternal, {
    linkId,
    summary: summary ?? kept,
    summaryStatus: summary || kept ? 'ready' : 'failed',
  })
}

// The background step after every save, import and retry. A link saved
// before its preview loaded, or imported with only a URL, title and tags,
// gets its title, description and image here; every link gets its summary.
export const enrich = internalAction({
  // `attempt`: how many times the summary has waited for the global budget.
  // `refresh`: re-enrichment of a link saved earlier (mutations.reenrichInternal).
  args: {
    linkId: v.id('links'),
    attempt: v.optional(v.number()),
    refresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<void> => {
    try {
      await runSummary(ctx, args.linkId, args.attempt ?? 0, !!args.refresh)
    } catch (error) {
      console.error('[enrich] Error', error)
      // A refresh never costs a link the summary it already had.
      if (!args.refresh) {
        await markFailed(ctx, args.linkId)
      }
    }
  },
})
