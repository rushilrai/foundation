'use node'

import { lookup } from 'node:dns/promises'

import { parseMetadata, type PageMetadata } from './parse'
import { domainOf, isFetchableUrl, isIpLiteral, isPrivateAddress } from './url'

// Link-preview crawlers get rich Open Graph tags from sites that serve
// browsers a script shell, Google Maps short links most of all.
const USER_AGENT =
  'Mozilla/5.0 (compatible; Webcase/1.0; link preview) facebookexternalhit/1.1'

const TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 5
const MAX_BYTES = 512 * 1024

export type FetchedPage = {
  // Where the last redirect landed
  finalUrl: string
  domain: string
  metadata: PageMetadata
}

export type FetchFailure =
  'BLOCKED' | 'TOO_MANY_REDIRECTS' | 'HTTP_ERROR' | 'NOT_HTML' | 'NETWORK'

// Rejects hostnames that resolve to loopback, private or link-local
// addresses, so a public-looking name can't point the fetch inward.
const resolvesPublicly = async (hostname: string): Promise<boolean> => {
  if (isIpLiteral(hostname)) {
    return !isPrivateAddress(hostname)
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true })
    return (
      addresses.length > 0 &&
      addresses.every(({ address }) => !isPrivateAddress(address))
    )
  } catch {
    return false
  }
}

const readCapped = async (response: Response): Promise<Uint8Array> => {
  if (!response.body) {
    return new Uint8Array()
  }

  const reader = response.body.getReader()
  const chunks: Array<Uint8Array> = []
  let size = 0

  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    chunks.push(value)
    size += value.byteLength
  }
  await reader.cancel().catch(() => undefined)

  const bytes = new Uint8Array(Math.min(size, MAX_BYTES))
  let offset = 0
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, bytes.length - offset)
    bytes.set(slice, offset)
    offset += slice.byteLength
    if (offset >= bytes.length) {
      break
    }
  }

  return bytes
}

// Charset from the Content-Type header, else a <meta charset> near the top.
const decodeHtml = (bytes: Uint8Array, contentType: string): string => {
  const sniff = new TextDecoder('latin1').decode(bytes.subarray(0, 2048))
  const charset =
    /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(sniff)?.[1] ??
    'utf-8'

  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

// Fetches a public web page and reads its metadata. Follows redirects by
// hand so every hop is re-validated. `domain` is the final page's host.
// Never throws.
export const fetchPage = async (
  rawUrl: string,
): Promise<
  { page: FetchedPage } | { error: FetchFailure; domain?: string }
> => {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { error: 'BLOCKED' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isFetchableUrl(url) || !(await resolvesPublicly(url.hostname))) {
        return { error: 'BLOCKED', domain: domainOf(url) }
      }

      const response = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'accept-language': 'en;q=0.9,*;q=0.5',
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel().catch(() => undefined)
        if (!location) {
          return { error: 'HTTP_ERROR', domain: domainOf(url) }
        }
        url = new URL(location, url)
        continue
      }

      const domain = domainOf(url)
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined)
        return { error: 'HTTP_ERROR', domain }
      }

      const contentType = response.headers.get('content-type') ?? ''
      const mediaType = contentType.split(';')[0].trim().toLowerCase()
      if (mediaType.startsWith('image/')) {
        // A direct image link is its own preview image.
        await response.body?.cancel().catch(() => undefined)
        return {
          page: { finalUrl: url.href, domain, metadata: { image: url.href } },
        }
      }
      if (mediaType !== 'text/html' && mediaType !== 'application/xhtml+xml') {
        await response.body?.cancel().catch(() => undefined)
        return { error: 'NOT_HTML', domain }
      }

      const html = decodeHtml(await readCapped(response), contentType)

      return {
        page: {
          finalUrl: url.href,
          domain,
          metadata: parseMetadata(html, url),
        },
      }
    }

    return { error: 'TOO_MANY_REDIRECTS', domain: domainOf(url) }
  } catch (error) {
    console.warn('[fetchPage] Failed', {
      host: url.hostname,
      error: error instanceof Error ? error.message : String(error),
    })
    return { error: 'NETWORK', domain: domainOf(url) }
  } finally {
    clearTimeout(timer)
  }
}
