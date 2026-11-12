// X serves crawlers "<name> (@handle) on X" and no post text, so a post's
// text and author come from its oEmbed endpoint. The title leads with the
// post's opening words, because the title is the line a library list
// shows; the description carries the whole post.

import { MAX_DESCRIPTION_LENGTH } from '../../../../shared/limits'
import { capText } from '../../text'
import { textOfHtml } from '../parse'
import { asRecord, hostOf, stringField, type Site } from './types'

const HOSTS = new Set([
  'x.com',
  'www.x.com',
  'mobile.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
])
const POST_PATH = /^\/(\w{1,15})\/status(?:es)?\/(\d{1,25})(?:\/|$)/

// How much of the post the title shows, after the author's name.
const TITLE_POST_LENGTH = 80

// The post's own text: the blockquote's <p>. The "— name (@handle) date"
// line after it is left out, and so are the trailing media links X adds.
const postText = (html: string): string | undefined => {
  const lower = html.toLowerCase()
  const open = lower.indexOf('<p')
  const close = open === -1 ? -1 : lower.indexOf('</p>', open)
  if (open === -1 || close === -1) {
    return undefined
  }

  const text = textOfHtml(html.slice(open, close), MAX_DESCRIPTION_LENGTH * 2)
  return capText(
    text
      ?.replace(
        /(?:\s*(?:pic\.(?:twitter|x)\.com\/\S+|https:\/\/t\.co\/\S+))+$/,
        '',
      )
      .trim(),
    MAX_DESCRIPTION_LENGTH,
  )
}

// The post's opening, cut at a word.
const opening = (text: string): string => {
  if (text.length <= TITLE_POST_LENGTH) {
    return text
  }
  const cut = text.slice(0, TITLE_POST_LENGTH - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > TITLE_POST_LENGTH / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

export const x: Site = {
  name: 'X',
  match: (url) => {
    if (!HOSTS.has(hostOf(url))) {
      return null
    }
    const post = POST_PATH.exec(url.pathname)
    if (!post) {
      return null
    }
    const [, handle, id] = post

    return {
      domain: 'x.com',
      provides: { description: true, image: false },
      resolve: async (getJson) => {
        const canonical = `https://x.com/${handle}/status/${id}`
        const body = asRecord(
          await getJson(
            `https://publish.x.com/oembed?omit_script=1&url=${encodeURIComponent(canonical)}`,
          ),
        )
        const author = stringField(body, 'author_name')
        const html = stringField(body, 'html')
        const text = html ? postText(html) : undefined
        if (!author && !text) {
          return null
        }

        const name = author ?? `@${handle}`
        return {
          title: text ? `${name}: ${opening(text)}` : `${name} on X`,
          description: text,
          text,
        }
      },
    }
  },
}
