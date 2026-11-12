'use node'

import type { LookupAddress } from 'node:dns'
import { lookup } from 'node:dns/promises'
import http, { type IncomingMessage } from 'node:http'
import https from 'node:https'
import type { LookupFunction } from 'node:net'
import type { Readable } from 'node:stream'
import zlib from 'node:zlib'

import { domainOf } from '../../../shared/url'
import { parseMetadata, type PageMetadata } from './parse'
import { isFetchableUrl, isIpLiteral, isPrivateAddress } from './url'

// Link-preview crawlers get rich Open Graph tags from sites that serve
// browsers a script shell, Google Maps short links most of all.
const USER_AGENT =
  'Mozilla/5.0 (compatible; Webcase/1.0; link preview) facebookexternalhit/1.1'

// The whole budget for reading a link: every request made for one link
// (the page and a site endpoint, see read.ts) shares one deadline.
export const FETCH_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 5
// Applies to the decoded body, so a small compressed bomb can't expand past it.
const MAX_BYTES = 512 * 1024

export type FetchedPage = {
  // Where the last redirect landed
  finalUrl: string
  domain: string
  metadata: PageMetadata
}

// Every URL the fetch requested, in order: the link first, then each
// redirect's target (the last is the page, or where it failed). Site
// rules read it, e.g. the address in a Maps short link's redirect.
export type Redirects = Array<URL>

export type FetchFailure =
  | 'BLOCKED'
  | 'TOO_MANY_REDIRECTS'
  | 'HTTP_ERROR'
  | 'NOT_HTML'
  | 'NETWORK'
  // A redirect ended on a consent, sign-in or bot-check page instead of the
  // page itself, e.g. YouTube sending a crawler to google.com/sorry.
  | 'INTERSTITIAL'

// Hosts and paths of the pages sites redirect crawlers to instead of the
// content. Only checked after a redirect: a sign-in page saved on purpose
// is still read.
const INTERSTITIAL_HOST = /^(consent|accounts|login|signin|auth|sso)\./
const INTERSTITIAL_PATH =
  /^\/(sorry|consent|login|signin|sign-in|authwall|accounts\/login|uas\/login)(\/|$)/i

const isInterstitial = (url: URL): boolean =>
  INTERSTITIAL_HOST.test(url.hostname.toLowerCase()) ||
  INTERSTITIAL_PATH.test(url.pathname)

// Exact titles of the well-known bot-check, block and sign-in pages that
// are served in place of the page itself, with or without a redirect
// (Cloudflare's challenge, Akamai's block). Exact only: a real title that
// merely contains these words is the page's.
const INTERSTITIAL_TITLES: ReadonlySet<string> = new Set([
  'just a moment...',
  'just a moment…',
  'attention required! | cloudflare',
  'access denied',
  'sign in',
  'log in',
])

const isInterstitialTitle = (title: string | undefined): boolean =>
  !!title && INTERSTITIAL_TITLES.has(title.trim().toLowerCase())

type PinnedAddress = { address: string; family: 4 | 6 }

// The one address the request will connect to, or null when the host is
// (or resolves to anything) loopback, private or link-local. Every answer
// must be public, then the first one is pinned: the connection uses this
// address instead of resolving the name again, so a short-TTL name can't
// answer public for the check and private for the connection.
const resolvePublicAddress = async (
  hostname: string,
): Promise<PinnedAddress | null> => {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (isIpLiteral(host)) {
    return isPrivateAddress(host)
      ? null
      : { address: host, family: host.includes(':') ? 6 : 4 }
  }

  let addresses: Array<LookupAddress>
  try {
    addresses = await lookup(host, { all: true, verbatim: true })
  } catch {
    return null
  }
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isPrivateAddress(address))
  ) {
    return null
  }

  const [first] = addresses
  return { address: first.address, family: first.family === 6 ? 6 : 4 }
}

// A `lookup` for http(s).request that answers only with the pinned address.
// Node asks for `all` when it races IPv4 and IPv6 (autoSelectFamily).
const pinnedLookup =
  (pinned: PinnedAddress): LookupFunction =>
  (_hostname, options, callback) => {
    if (options.all) {
      ;(
        callback as unknown as (
          error: null,
          addresses: Array<LookupAddress>,
        ) => void
      )(null, [pinned])
    } else {
      callback(null, pinned.address, pinned.family)
    }
  }

const ACCEPT = {
  html: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
  json: 'application/json',
} as const

type BodyKind = keyof typeof ACCEPT

// One GET to the pinned address. TLS SNI and the Host header still carry
// the hostname, because the URL does. No connection pooling: each hop gets
// its own socket to the address it was validated against.
const requestOnce = (
  url: URL,
  pinned: PinnedAddress,
  accept: BodyKind,
  signal: AbortSignal,
): Promise<IncomingMessage> =>
  new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: 'GET',
      agent: false,
      lookup: pinnedLookup(pinned),
      signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: ACCEPT[accept],
        'accept-language': 'en;q=0.9,*;q=0.5',
        'accept-encoding': 'gzip, deflate, br',
        connection: 'close',
      },
    })
    request.once('response', resolve)
    request.once('error', reject)
    request.end()
  })

// The response body with its Content-Encoding undone, or null for an
// encoding we didn't ask for.
const decodedBody = (response: IncomingMessage): Readable | null => {
  const encoding = (response.headers['content-encoding'] ?? 'identity')
    .trim()
    .toLowerCase()

  switch (encoding) {
    case 'identity':
    case '':
      return response
    case 'gzip':
    case 'x-gzip':
      return response.pipe(zlib.createGunzip())
    case 'deflate':
      return response.pipe(zlib.createInflate())
    case 'br':
      return response.pipe(zlib.createBrotliDecompress())
    default:
      return null
  }
}

// Reads at most MAX_BYTES, then drops the connection. A body cut short
// (a truncated gzip stream, the timeout) still yields what arrived, since
// the metadata sits at the top.
const readCapped = async (
  response: IncomingMessage,
  body: Readable,
): Promise<Uint8Array> => {
  const chunks: Array<Buffer> = []
  let size = 0

  try {
    for await (const chunk of body) {
      const buffer = chunk as Buffer
      chunks.push(buffer)
      size += buffer.byteLength
      if (size >= MAX_BYTES) {
        break
      }
    }
  } catch (error) {
    if (size === 0) {
      throw error
    }
  } finally {
    body.destroy()
    response.destroy()
  }

  return new Uint8Array(Buffer.concat(chunks).subarray(0, MAX_BYTES))
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

const header = (response: IncomingMessage, name: string): string => {
  const value = response.headers[name]
  return (Array.isArray(value) ? value[0] : value) ?? ''
}

type Opened =
  | { response: IncomingMessage; url: URL }
  // A redirect to a URL `stopAt` accepted, not requested.
  | { stopped: URL }
  | { error: FetchFailure }

// The GET that answered with something other than a redirect, and where
// it was. Follows redirects by hand so every hop is re-validated and
// pinned, and records each URL requested in `redirects`. With `stopAt`, a
// redirect whose target it accepts ends there without requesting it. The
// caller reads or destroys the response.
const openGuarded = async (
  start: URL,
  accept: BodyKind,
  signal: AbortSignal,
  redirects: Redirects = [],
  stopAt?: (url: URL) => boolean,
): Promise<Opened> => {
  let url = start

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    redirects.push(url)
    const pinned = isFetchableUrl(url)
      ? await resolvePublicAddress(url.hostname)
      : null
    if (!pinned) {
      return { error: 'BLOCKED' }
    }

    const response = await requestOnce(url, pinned, accept, signal)
    const status = response.statusCode ?? 0

    if (status >= 300 && status < 400) {
      const location = header(response, 'location')
      response.destroy()
      if (!location) {
        return { error: 'HTTP_ERROR' }
      }
      url = new URL(location, url)
      if (stopAt?.(url)) {
        return { stopped: url }
      }
      continue
    }

    if (status < 200 || status >= 300) {
      response.destroy()
      return { error: 'HTTP_ERROR' }
    }
    if (hop > 0 && isInterstitial(url)) {
      response.destroy()
      return { error: 'INTERSTITIAL' }
    }

    return { response, url }
  }

  return { error: 'TOO_MANY_REDIRECTS' }
}

const mediaTypeOf = (response: IncomingMessage): string =>
  header(response, 'content-type').split(';')[0].trim().toLowerCase()

// Fetches a public web page and reads its metadata. `domain` is the final
// page's host. A failure carries no host: where a failed fetch ended up
// (a bot check, a consent page) says nothing about the link, so callers
// use the saved URL's own. Both carry the `redirects` followed, for site
// rules. A page titled like a bot check or sign-in page
// (INTERSTITIAL_TITLES) is a failure too. `signal` is the deadline, shared
// with any other request made for the same link; without one the page
// gets FETCH_TIMEOUT_MS of its own. Never throws.
export const fetchPage = async (
  rawUrl: string,
  signal: AbortSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS),
): Promise<
  | { page: FetchedPage; redirects: Redirects }
  | { error: FetchFailure; redirects: Redirects }
> => {
  const redirects: Redirects = []
  let start: URL
  try {
    start = new URL(rawUrl)
  } catch {
    return { error: 'BLOCKED', redirects }
  }

  try {
    const opened = await openGuarded(start, 'html', signal, redirects)
    if ('error' in opened) {
      return { error: opened.error, redirects }
    }
    if ('stopped' in opened) {
      return { error: 'NETWORK', redirects }
    }
    const { response, url } = opened
    const domain = domainOf(url)

    const mediaType = mediaTypeOf(response)
    if (mediaType.startsWith('image/')) {
      // A direct image link is its own preview image.
      response.destroy()
      return {
        page: { finalUrl: url.href, domain, metadata: { image: url.href } },
        redirects,
      }
    }
    if (mediaType !== 'text/html' && mediaType !== 'application/xhtml+xml') {
      response.destroy()
      return { error: 'NOT_HTML', redirects }
    }

    const body = decodedBody(response)
    if (!body) {
      response.destroy()
      return { error: 'NOT_HTML', redirects }
    }

    const html = decodeHtml(
      await readCapped(response, body),
      header(response, 'content-type'),
    )
    const metadata = parseMetadata(html, url)
    if (isInterstitialTitle(metadata.title)) {
      return { error: 'INTERSTITIAL', redirects }
    }

    return { page: { finalUrl: url.href, domain, metadata }, redirects }
  } catch (error) {
    console.warn('[fetchPage] Failed', {
      host: start.hostname,
      error: error instanceof Error ? error.message : String(error),
    })
    return { error: 'NETWORK', redirects }
  }
}

// Follows a link's redirects through the same guarded, pinned path until
// one points at a URL `until` accepts, and returns that URL without
// requesting it: where a share link really goes. Null when the redirects
// end anywhere else, fail, or run out of time. Never throws.
export const locateRedirect = async (
  start: URL,
  until: (url: URL) => boolean,
  signal: AbortSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS),
): Promise<URL | null> => {
  try {
    const opened = await openGuarded(start, 'html', signal, [], until)
    if ('response' in opened) {
      opened.response.destroy()
    }
    return 'stopped' in opened ? opened.stopped : null
  } catch (error) {
    console.warn('[locateRedirect] Failed', {
      host: start.hostname,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Fetches a JSON document from a public API through the same guarded,
// pinned, size-capped path as pages. The parsed body, unvalidated (callers
// check its shape), or null for any failure: blocked, an HTTP error, not
// JSON, cut off at the size cap, or the deadline. Never throws.
export const fetchJson = async (
  rawUrl: string,
  signal: AbortSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS),
): Promise<unknown> => {
  let start: URL
  try {
    start = new URL(rawUrl)
  } catch {
    return null
  }

  try {
    const opened = await openGuarded(start, 'json', signal)
    if (!('response' in opened)) {
      console.log('[fetchJson] Not read', {
        host: start.hostname,
        error: 'error' in opened ? opened.error : 'NETWORK',
      })
      return null
    }
    const { response } = opened

    const mediaType = mediaTypeOf(response)
    const body =
      mediaType === 'application/json' || mediaType.endsWith('+json')
        ? decodedBody(response)
        : null
    if (!body) {
      response.destroy()
      return null
    }

    const bytes = await readCapped(response, body)
    // A body at the cap was cut off, so it isn't the whole document.
    if (bytes.byteLength >= MAX_BYTES) {
      return null
    }

    return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as unknown
  } catch (error) {
    console.warn('[fetchJson] Failed', {
      host: start.hostname,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
