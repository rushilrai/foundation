// news.ycombinator.com doesn't answer Convex's servers, so an item comes
// from the official Firebase API.

import { MAX_DESCRIPTION_LENGTH } from '../../../../shared/limits'
import { textOfHtml } from '../parse'
import { asRecord, hostOf, numberField, stringField, type Site } from './types'

// Body text kept for the summary.
const MAX_TEXT_LENGTH = 2000

const linkedHost = (raw: string | undefined): string | undefined => {
  try {
    return raw ? new URL(raw).hostname.replace(/^www\./, '') : undefined
  } catch {
    return undefined
  }
}

export const hackerNews: Site = {
  name: 'Hacker News',
  match: (url) => {
    if (hostOf(url) !== 'news.ycombinator.com' || url.pathname !== '/item') {
      return null
    }
    const id = url.searchParams.get('id') ?? ''
    if (!/^\d{1,12}$/.test(id)) {
      return null
    }

    return {
      domain: 'news.ycombinator.com',
      provides: { description: true, image: false },
      resolve: async (getJson) => {
        const item = asRecord(
          await getJson(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
          ),
        )
        if (!item || item.deleted === true || item.dead === true) {
          return null
        }

        const by = stringField(item, 'by')
        const score = numberField(item, 'score')
        const text = textOfHtml(
          stringField(item, 'text') ?? '',
          MAX_TEXT_LENGTH,
        )
        // A comment has no title: its opening words stand in.
        const title =
          stringField(item, 'title') ??
          (text ? textOfHtml(text, 100) : undefined)
        if (!title) {
          return null
        }

        const host = linkedHost(stringField(item, 'url'))
        const byline = [
          score !== undefined
            ? `${score} ${score === 1 ? 'point' : 'points'}`
            : undefined,
          by ? `by ${by}` : undefined,
        ]
          .filter(Boolean)
          .join(' ')

        return {
          title,
          description:
            [byline, host]
              .filter(Boolean)
              .join(' · ')
              .slice(0, MAX_DESCRIPTION_LENGTH) || undefined,
          text,
        }
      },
    }
  },
}
