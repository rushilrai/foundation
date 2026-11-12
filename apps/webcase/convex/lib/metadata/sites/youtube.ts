// YouTube serves crawlers from cloud addresses a bot check, so a video's
// title, channel and thumbnail come from its oEmbed endpoint instead.

import { asRecord, hostOf, stringField, type Site } from './types'

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
])
const VIDEO_ID = /^[\w-]{11}$/

const videoId = (url: URL): string | null => {
  const host = hostOf(url)
  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] ?? ''
    return VIDEO_ID.test(id) ? id : null
  }
  if (!HOSTS.has(host)) {
    return null
  }

  if (url.pathname === '/watch') {
    const id = url.searchParams.get('v') ?? ''
    return VIDEO_ID.test(id) ? id : null
  }
  const shorts = /^\/shorts\/([\w-]{11})(?:\/|$)/.exec(url.pathname)
  return shorts ? shorts[1] : null
}

export const youtube: Site = {
  name: 'YouTube',
  provides: { description: true, image: true },
  match: (url) => {
    const id = videoId(url)
    if (!id) {
      return null
    }

    return {
      domain: 'youtube.com',
      resolve: async (getJson) => {
        // The canonical watch URL, rebuilt from the id alone, so a time or
        // playlist parameter can't make the lookup fail.
        const video = `https://www.youtube.com/watch?v=${id}`
        const body = asRecord(
          await getJson(
            `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video)}`,
          ),
        )
        const title = stringField(body, 'title')
        if (!title) {
          return null
        }
        const channel = stringField(body, 'author_name')

        return {
          title,
          description: channel ? `${channel} on YouTube` : undefined,
          image: stringField(body, 'thumbnail_url'),
        }
      },
    }
  },
}
