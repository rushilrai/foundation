'use node'

import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { action, internalAction, type ActionCtx } from '../../_generated/server'
import { MAX_QUESTION_LENGTH } from '../../../shared/limits'
import { rateLimiter } from '../../configs/rateLimiter'
import { fetchPage } from '../../lib/metadata/fetch'
import {
  domainOf,
  fallbackTitle,
  isPlaceholderTitle,
  parseHttpUrl,
} from '../../lib/metadata/url'
import { getUserId } from '../auth/helpers'
import { answerQuestion, suggestTags, summarizePage } from './ai'
import type { ExistingLink } from './queries'

// Every action in this module runs in the Node runtime: page fetches pin
// DNS answers through node:http(s), and the AI SDK calls need Node too.

export type LinkPreview = {
  // Normalised; pass it to `create` as is.
  url: string
  domain: string
  title: string
  description?: string
  image?: string
  suggestedTags: Array<string>
  // False when the page couldn't be read (blocked, failed, not HTML) or
  // the global preview budget is spent: the fields come from the URL alone.
  fetched: boolean
  // The user's saved link at this URL, or null when it is new.
  existing: ExistingLink | null
}

// What the save sheet shows before saving. Always succeeds for a valid
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
    const fallback = (domain?: string): { preview: LinkPreview } => ({
      preview: {
        url,
        domain: domain ?? domainOf(parsed),
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

    const [fetched, tagStats] = await Promise.all([
      fetchPage(url),
      ctx.runQuery(internal.modules.link.queries.tagStatsInternal, { userId }),
    ])

    if (!('page' in fetched)) {
      console.log('[preview] Page not read', { error: fetched.error })
      return fallback(fetched.domain)
    }

    const { domain, metadata } = fetched.page
    const title = metadata.title ?? fallbackTitle(parsed)

    // Only worth asking when the page told us something beyond its URL.
    const suggestions =
      metadata.title || metadata.description
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

    const entries = await ctx.runQuery(
      internal.modules.link.queries.askEntriesInternal,
      { userId },
    )
    if (entries.length === 0) {
      return { answer: "You haven't saved any links yet.", linkIds: [] }
    }

    const { ok } = await rateLimiter.limit(ctx, 'ask', { key: userId })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
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
// link was deleted meanwhile); a `failed` one can be redone with
// mutations.retrySummary.

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

// Fetches the page, optionally fills missing metadata from it, then writes
// the summary.
const runSummary = async (
  ctx: ActionCtx,
  linkId: Id<'links'>,
  { fillMetadata }: { fillMetadata: boolean },
): Promise<void> => {
  let link = await ctx.runQuery(internal.modules.link.queries.getInternal, {
    linkId,
  })
  if (!link) {
    return
  }

  // Each run costs a page fetch and a model call, so it is counted against
  // the global budget before either happens.
  const global = await rateLimiter.limit(ctx, 'summaryGlobal')
  if (!global.ok) {
    console.warn('[summary] Global summary budget spent')
    await markFailed(ctx, linkId)
    return
  }

  const result = parseHttpUrl(link.url) ? await fetchPage(link.url) : null
  const page = result && 'page' in result ? result.page : undefined

  if (fillMetadata && page) {
    const { domain, metadata } = page
    await ctx.runMutation(
      internal.modules.link.mutations.applyMetadataInternal,
      {
        linkId,
        domain,
        title:
          metadata.title && isPlaceholderTitle(link.title, link.url)
            ? metadata.title
            : undefined,
        description: metadata.description,
        image: metadata.image,
      },
    )
  } else if (fillMetadata && result && 'error' in result && result.domain) {
    // The page failed but a redirect still told us where it lives.
    await ctx.runMutation(
      internal.modules.link.mutations.applyMetadataInternal,
      { linkId, domain: result.domain },
    )
  }

  if (fillMetadata) {
    link =
      (await ctx.runQuery(internal.modules.link.queries.getInternal, {
        linkId,
      })) ?? link
  }

  const metadata = page?.metadata
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

  await ctx.runMutation(internal.modules.link.mutations.setSummaryInternal, {
    linkId,
    summary: summary ?? undefined,
    summaryStatus: summary ? 'ready' : 'failed',
  })
}

// Summary for a link saved through `create`, whose metadata came from the
// preview. Fetches the page again for a body-text extract and the page's
// current title.
export const summarize = internalAction({
  args: { linkId: v.id('links') },
  handler: async (ctx, args): Promise<void> => {
    try {
      await runSummary(ctx, args.linkId, { fillMetadata: false })
    } catch (error) {
      console.error('[summarize] Error', error)
      await markFailed(ctx, args.linkId)
    }
  },
})

// For imported links, which arrive with only a URL, title and tags, and
// for retries: fetch the page metadata, fill what's missing, then
// summarize.
export const enrich = internalAction({
  args: { linkId: v.id('links') },
  handler: async (ctx, args): Promise<void> => {
    try {
      await runSummary(ctx, args.linkId, { fillMetadata: true })
    } catch (error) {
      console.error('[enrich] Error', error)
      await markFailed(ctx, args.linkId)
    }
  },
})
