// Stack Overflow and the other Stack Exchange sites refuse Convex's
// servers (403), so a question's title comes from the Stack Exchange API.

import { decodeEntities } from '../parse'
import { asRecord, hostOf, stringField, type Site } from './types'

// Hosts that aren't <name>.stackexchange.com, with the API's `site` value
// and the site's name.
const SITES: Record<string, { site: string; name: string }> = {
  'stackoverflow.com': { site: 'stackoverflow', name: 'Stack Overflow' },
  'superuser.com': { site: 'superuser', name: 'Super User' },
  'serverfault.com': { site: 'serverfault', name: 'Server Fault' },
  'askubuntu.com': { site: 'askubuntu', name: 'Ask Ubuntu' },
}
const QUESTION_PATH = /^\/(?:questions|q)\/(\d{1,12})(?:\/|$)/

// The API's site value and the site's name for a host, or null.
const siteOf = (host: string): { site: string; name: string } | null => {
  const bare = host.replace(/^www\./, '')
  const known = SITES[bare]
  if (known) {
    return known
  }

  // The API takes a *.stackexchange.com site by its full domain.
  const sub = /^([a-z0-9-]{1,40})\.stackexchange\.com$/.exec(bare)?.[1]
  if (!sub || sub === 'api') {
    return null
  }
  const label = sub
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
  return { site: bare, name: `${label} Stack Exchange` }
}

export const stackExchange: Site = {
  name: 'Stack Exchange',
  match: (url) => {
    const host = hostOf(url)
    const site = siteOf(host)
    const question = QUESTION_PATH.exec(url.pathname)
    if (!site || !question) {
      return null
    }
    const id = question[1]

    return {
      domain: host.replace(/^www\./, ''),
      provides: { description: true, image: false },
      resolve: async (getJson) => {
        const body = asRecord(
          await getJson(
            `https://api.stackexchange.com/2.3/questions/${id}?site=${encodeURIComponent(site.site)}`,
          ),
        )
        const items = body?.items
        const item = Array.isArray(items) ? asRecord(items[0]) : null
        const title = stringField(item, 'title')
        if (!title) {
          return null
        }

        const tags = Array.isArray(item?.tags)
          ? item.tags.filter((tag): tag is string => typeof tag === 'string')
          : []
        return {
          // The API sends titles HTML-encoded ("&quot;").
          title: decodeEntities(title),
          description: site.name,
          text: tags.length
            ? `Tags: ${tags.slice(0, 10).join(', ')}`
            : undefined,
        }
      },
    }
  },
}
