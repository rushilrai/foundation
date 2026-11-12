// Reddit gives crawlers "From the <sub> community on Reddit: <post title>"
// (or only the prefix) and a description that says nothing. The prefix and
// that description are dropped from the page, and a post's clean title
// comes from its oEmbed endpoint.

import type { PageMetadata } from '../parse'
import { asRecord, hostOf, stringField, type Site } from './types'

const HOSTS = new Set([
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'new.reddit.com',
  'm.reddit.com',
  'np.reddit.com',
])
// A post: /r/<sub>/comments/<id>/… or /user/<name>/comments/<id>/…
const POST_PATH =
  /^\/(r|u|user)\/([\w-]{1,50})\/comments\/([a-z0-9]{1,12})(?:\/|$)/i

const TITLE_PREFIX = /^From the \S+ community on Reddit(?::\s*|$)/
const GENERIC_DESCRIPTION =
  /^Explore this post and more from the \S+ community$/

// A stored or read title without Reddit's prefix; empty when the prefix was
// all there was.
export const withoutRedditPrefix = (title: string): string =>
  title.replace(TITLE_PREFIX, '').trim()

export const hasRedditPrefix = (title: string): boolean =>
  TITLE_PREFIX.test(title.trim())

export const isGenericRedditDescription = (
  description: string | undefined,
): boolean => !!description && GENERIC_DESCRIPTION.test(description.trim())

const cleanPage = (metadata: PageMetadata): PageMetadata => ({
  ...metadata,
  title: metadata.title
    ? withoutRedditPrefix(metadata.title) || undefined
    : undefined,
  description: isGenericRedditDescription(metadata.description)
    ? undefined
    : metadata.description,
})

export const reddit: Site = {
  name: 'Reddit',
  provides: { description: false, image: false },
  match: (url) => {
    if (!HOSTS.has(hostOf(url))) {
      return null
    }
    const post = POST_PATH.exec(url.pathname)
    if (!post) {
      // Share links (/r/<sub>/s/<code>) and other pages are read from the
      // page alone, which still has the prefix to drop.
      return { domain: 'reddit.com', cleanPage }
    }
    const [, kind, name, id] = post

    return {
      domain: 'reddit.com',
      cleanPage,
      resolve: async (getJson) => {
        const canonical = `https://www.reddit.com/${kind.toLowerCase() === 'r' ? 'r' : 'user'}/${name}/comments/${id.toLowerCase()}/`
        const body = asRecord(
          await getJson(
            `https://www.reddit.com/oembed?url=${encodeURIComponent(canonical)}`,
          ),
        )
        const title = stringField(body, 'title')
        return title ? { title } : null
      },
    }
  },
}
