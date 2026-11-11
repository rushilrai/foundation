'use node'

import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { action } from '../../_generated/server'
import { rateLimiter } from '../../configs/rateLimiter'
import { fetchPage } from '../../lib/metadata/fetch'
import { domainOf, fallbackTitle, parseHttpUrl } from '../../lib/metadata/url'
import { getUserId } from '../auth/helpers'
import { answerQuestion, suggestTags } from './ai'

export type LinkPreview = {
  url: string
  domain: string
  title: string
  description?: string
  image?: string
  suggestedTags: Array<string>
  alreadySaved: boolean
}

// What the save sheet shows before saving. Always succeeds for a valid
// http(s) URL: when the page can't be fetched (or may not be, e.g. a
// private address) it falls back to the URL's host and path.
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
    const url = args.url.trim()

    const { ok } = await rateLimiter.limit(ctx, 'preview', { key: userId })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    const [alreadySaved, fetched, tagStats] = await Promise.all([
      ctx.runQuery(internal.modules.link.queries.isSavedInternal, {
        userId,
        url,
      }),
      fetchPage(url),
      ctx.runQuery(internal.modules.link.queries.tagStatsInternal, { userId }),
    ])

    if (!('page' in fetched)) {
      console.log('[preview] Page not read', { error: fetched.error })
      return {
        preview: {
          url,
          domain: fetched.domain ?? domainOf(parsed),
          title: fallbackTitle(parsed),
          suggestedTags: [],
          alreadySaved,
        },
      }
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
        alreadySaved,
      },
    }
  },
})

const MAX_QUESTION_LENGTH = 500

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

    const result = await answerQuestion(question, entries, userId)

    return result ?? { error: 'AI_UNAVAILABLE' }
  },
})
