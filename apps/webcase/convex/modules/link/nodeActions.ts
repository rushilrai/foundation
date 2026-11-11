'use node'

import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { internalAction, type ActionCtx } from '../../_generated/server'
import { fetchPage } from '../../lib/metadata/fetch'
import type { PageMetadata } from '../../lib/metadata/parse'
import { isPlaceholderTitle, parseHttpUrl } from '../../lib/metadata/url'
import { summarizePage } from './ai'

const storeSummary = async (
  ctx: ActionCtx,
  link: Doc<'links'>,
  fetched: PageMetadata | undefined,
): Promise<void> => {
  const summary = await summarizePage(
    {
      url: link.url,
      domain: link.domain,
      title: link.title,
      pageTitle: fetched?.title,
      description: link.description ?? fetched?.description,
      text: fetched?.text,
    },
    link.userId,
  )

  await ctx.runMutation(internal.modules.link.mutations.setSummaryInternal, {
    linkId: link._id,
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
      const link = await ctx.runQuery(
        internal.modules.link.queries.getInternal,
        { linkId: args.linkId },
      )
      if (!link) {
        return
      }

      const result = parseHttpUrl(link.url) ? await fetchPage(link.url) : null
      await storeSummary(
        ctx,
        link,
        result && 'page' in result ? result.page.metadata : undefined,
      )
    } catch (error) {
      console.error('[summarize] Error', error)
      await ctx.runMutation(
        internal.modules.link.mutations.setSummaryInternal,
        { linkId: args.linkId, summaryStatus: 'failed' },
      )
    }
  },
})

// For imported links, which arrive with only a URL, title and tags: fetch
// the page metadata, fill what's missing, then summarize.
export const enrich = internalAction({
  args: { linkId: v.id('links') },
  handler: async (ctx, args): Promise<void> => {
    try {
      let link = await ctx.runQuery(internal.modules.link.queries.getInternal, {
        linkId: args.linkId,
      })
      if (!link) {
        return
      }

      const result = parseHttpUrl(link.url) ? await fetchPage(link.url) : null
      let fetched: PageMetadata | undefined

      if (result && 'page' in result) {
        const { domain, metadata } = result.page
        fetched = metadata

        await ctx.runMutation(
          internal.modules.link.mutations.applyMetadataInternal,
          {
            linkId: link._id,
            domain,
            title:
              metadata.title && isPlaceholderTitle(link.title, link.url)
                ? metadata.title
                : undefined,
            description: metadata.description,
            image: metadata.image,
          },
        )
      } else if (result?.domain) {
        // The page failed but a redirect still told us where it lives.
        await ctx.runMutation(
          internal.modules.link.mutations.applyMetadataInternal,
          { linkId: link._id, domain: result.domain },
        )
      }

      link =
        (await ctx.runQuery(internal.modules.link.queries.getInternal, {
          linkId: args.linkId,
        })) ?? link

      await storeSummary(ctx, link, fetched)
    } catch (error) {
      console.error('[enrich] Error', error)
      await ctx.runMutation(
        internal.modules.link.mutations.setSummaryInternal,
        { linkId: args.linkId, summaryStatus: 'failed' },
      )
    }
  },
})
