// Pure, server-only URL helpers: cleaning image URLs and deciding which
// hosts are safe to fetch. No I/O here. Parsing and normalising links, and
// the values derived from them, are in shared/url.ts.

import { MAX_IMAGE_URL_LENGTH } from '../../../shared/limits'

// An image URL as stored: absolute http(s) (resolved against `base` when
// given), within the length limit, else undefined.
export const cleanImageUrl = (
  raw: string | undefined,
  base?: URL,
): string | undefined => {
  const value = raw?.trim()
  if (!value) {
    return undefined
  }

  try {
    const url = new URL(value, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }
    return url.href.length > MAX_IMAGE_URL_LENGTH ? undefined : url.href
  } catch {
    return undefined
  }
}

// Hosts we refuse to fetch, by name. IP literals are checked separately
// with isPrivateAddress.
const isBlockedHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/\.$/, '')

  if (!host.includes('.')) {
    // localhost and other single-label intranet names
    return true
  }

  return (
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home.arpa')
  )
}

// URL.hostname keeps the brackets around IPv6 literals.
const stripBrackets = (hostname: string): string =>
  hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname

const parseIPv4 = (value: string): Array<number> | null => {
  const parts = value.split('.')
  if (parts.length !== 4) {
    return null
  }

  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? +part : NaN))
  if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) {
    return null
  }

  return octets
}

const isPrivateIPv4 = ([a, b]: Array<number>): boolean =>
  a === 0 || // "this" network
  a === 10 ||
  a === 127 || // loopback
  (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
  (a === 169 && b === 254) || // link-local, cloud metadata
  (a === 172 && b >= 16 && b <= 31) ||
  (a === 192 && b === 168) ||
  (a === 192 && b === 0) || // IETF protocol assignments
  (a === 198 && (b === 18 || b === 19)) || // benchmarking
  a >= 224 // multicast, reserved, broadcast

// Expands an IPv6 address to eight 16-bit groups, or null if it isn't one.
const parseIPv6 = (value: string): Array<number> | null => {
  let address = value.toLowerCase().split('%')[0]
  if (!address.includes(':')) {
    return null
  }

  // A trailing dotted IPv4 part (e.g. ::ffff:127.0.0.1) becomes two groups.
  const lastColon = address.lastIndexOf(':')
  const tail = address.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail)
    if (!v4) {
      return null
    }
    address = `${address.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`
  }

  const halves = address.split('::')
  if (halves.length > 2) {
    return null
  }

  const toGroups = (part: string): Array<number> | null => {
    if (!part) {
      return []
    }
    const groups = part.split(':')
    if (groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) {
      return null
    }
    return groups.map((group) => parseInt(group, 16))
  }

  const head = toGroups(halves[0])
  const rest = halves.length === 2 ? toGroups(halves[1]) : []
  if (!head || !rest) {
    return null
  }

  if (halves.length === 1) {
    return head.length === 8 ? head : null
  }

  const missing = 8 - head.length - rest.length
  if (missing < 1) {
    return null
  }

  return [...head, ...Array<number>(missing).fill(0), ...rest]
}

const isPrivateIPv6 = (groups: Array<number>): boolean => {
  const [first] = groups

  if (groups.every((group) => group === 0)) {
    return true // unspecified ::
  }
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) {
    return true // loopback ::1
  }

  const embedded = (high: number, low: number): Array<number> => [
    high >> 8,
    high & 0xff,
    low >> 8,
    low & 0xff,
  ]

  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and
  // well-known NAT64 (64:ff9b::a.b.c.d) addresses: judge the embedded IPv4
  // address.
  if (
    (groups.slice(0, 5).every((group) => group === 0) &&
      (groups[5] === 0xffff || groups[5] === 0)) ||
    (first === 0x64 &&
      groups[1] === 0xff9b &&
      groups.slice(2, 6).every((group) => group === 0))
  ) {
    return isPrivateIPv4(embedded(groups[6], groups[7]))
  }
  // 6to4 (2002:aabb:ccdd::/48) carries the IPv4 address in groups 1-2.
  if (first === 0x2002) {
    return isPrivateIPv4(embedded(groups[1], groups[2]))
  }
  // Local-use NAT64 (64:ff9b:1::/48) may embed IPv4 at any of several
  // offsets and is never a public destination, so the whole range is out.
  // So is Teredo (2001:0::/32), whose embedded address is obfuscated.
  if (
    (first === 0x64 && groups[1] === 0xff9b && groups[2] === 1) ||
    (first === 0x2001 && groups[1] === 0)
  ) {
    return true
  }

  return (
    (first & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xffc0) === 0xfec0 || // site-local (deprecated) fec0::/10
    (first & 0xff00) === 0xff00 || // multicast ff00::/8
    (first === 0x2001 && groups[1] === 0x0db8) // documentation
  )
}

// True for an IP address (v4 or v6) that is loopback, private, link-local
// or otherwise not a public internet address. Non-IP strings return false.
export const isPrivateAddress = (value: string): boolean => {
  const address = stripBrackets(value)

  const v4 = parseIPv4(address)
  if (v4) {
    return isPrivateIPv4(v4)
  }

  const v6 = parseIPv6(address)
  if (v6) {
    return isPrivateIPv6(v6)
  }

  return false
}

export const isIpLiteral = (hostname: string): boolean => {
  const address = stripBrackets(hostname)

  return parseIPv4(address) !== null || parseIPv6(address) !== null
}

// Whether a URL may be fetched at all, judged from the URL alone. Hostnames
// still need their DNS answers checked before connecting (see fetch.ts).
export const isFetchableUrl = (url: URL): boolean => {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  if (url.username || url.password) {
    return false
  }
  if (url.port && url.port !== '80' && url.port !== '443') {
    // Public pages live on the default ports; anything else is far more
    // likely to be an internal service.
    return false
  }

  if (isIpLiteral(url.hostname)) {
    return !isPrivateAddress(url.hostname)
  }

  return !isBlockedHostname(url.hostname)
}
