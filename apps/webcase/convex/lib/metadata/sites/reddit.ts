// Reddit gives crawlers "From the <sub> community on Reddit: <post title>"
// (or only the prefix) and a description that says nothing. The prefix and
// that description are dropped from the page, and a post's clean title
// comes from its oEmbed endpoint. A share link (/r/<sub>/s/<code>, or
// redd.it/<id>) is first followed to the post it redirects to (rewrite),
// then read as that post; the share link stays the stored URL.

import {
  asRecord,
  hostOf,
  stringField,
  type Site,
  type SitePage,
} from './types'

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
// A share link from the app: /r/<sub>/s/<code>, which redirects to the post.
const SHARE_PATH = /^\/r\/[\w-]{1,50}\/s\/[\w-]{1,20}\/?$/i
// redd.it/<id>: to /comments/<id>, then to the post.
const SHORT_PATH = /^\/[a-z0-9]{1,12}\/?$/i

const TITLE_PREFIX = /^From the \S+ community on Reddit(?::\s*|$)/
const GENERIC_DESCRIPTION =
  /^Explore this post and more from the \S+ community$/

const isPost = (url: URL): boolean =>
  HOSTS.has(hostOf(url)) && POST_PATH.test(url.pathname)

// The prefix dropped; "Reddit" alone (a share link's page) names nothing.
const cleanTitle = (title: string): string | undefined => {
  const value = title.trim().replace(TITLE_PREFIX, '').trim()
  return value && value !== 'Reddit' ? value : undefined
}

// "Explore this post and more…", or the prefixed title again (a share
// link's page puts "From the <sub> community on Reddit: <title>" there).
const isGenericDescription = (description: string): boolean =>
  GENERIC_DESCRIPTION.test(description.trim()) ||
  TITLE_PREFIX.test(description.trim())

const page: SitePage = {
  domain: 'reddit.com',
  provides: { description: false, image: false },
  cleanTitle,
  isGenericDescription,
}

export const reddit: Site = {
  name: 'Reddit',
  match: (url) => {
    const host = hostOf(url)
    const share =
      (HOSTS.has(host) && SHARE_PATH.test(url.pathname)) ||
      (host === 'redd.it' && SHORT_PATH.test(url.pathname))
    if (share) {
      return { ...page, rewrite: (locate) => locate(isPost) }
    }
    if (!HOSTS.has(host)) {
      return null
    }
    const post = POST_PATH.exec(url.pathname)
    if (!post) {
      // Other pages are read from the page alone, which still has the
      // prefix to drop.
      return page
    }
    const [, kind, name, id] = post

    return {
      ...page,
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
