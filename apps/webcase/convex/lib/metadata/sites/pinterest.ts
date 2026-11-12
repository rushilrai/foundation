// Pinterest gives crawlers an empty page, so a pin's title, pinner and
// image come from its oEmbed endpoint.

import { asRecord, hostOf, stringField, type Site } from './types'

// pinterest.<tld>, with www. or a country prefix (in.pinterest.com).
const HOST = /^(?:[a-z]{2,3}\.)?pinterest\.[a-z]{2,3}(?:\.[a-z]{2})?$/
const PIN_PATH = /^\/pin\/([\w-]{1,40})\/?$/

export const pinterest: Site = {
  name: 'Pinterest',
  provides: { description: true, image: true },
  match: (url) => {
    const host = hostOf(url)
    const id = PIN_PATH.exec(url.pathname)?.[1]
    if (!HOST.test(host) || !id) {
      return null
    }

    return {
      domain: host.replace(/^www\./, ''),
      resolve: async (getJson) => {
        const pin = `https://www.pinterest.com/pin/${id}/`
        const body = asRecord(
          await getJson(
            `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pin)}`,
          ),
        )
        const pinner = stringField(body, 'author_name')
        const image = stringField(body, 'thumbnail_url')
        const title = stringField(body, 'title')
        if (!title && !image) {
          return null
        }

        return {
          title: title ?? (pinner ? `Pin by ${pinner}` : undefined),
          description: pinner ? `Pinned by ${pinner} on Pinterest` : undefined,
          image,
        }
      },
    }
  },
}
