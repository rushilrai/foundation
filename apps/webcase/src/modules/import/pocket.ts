import { parseHttpUrl } from '@convex/lib/metadata/url'
import { normalizeTags, type TagCount } from '@shared/tags'

import { countTags } from '@/modules/link/utils'
import { parseCsv } from './csv'

// One row of a Pocket export, shaped for `importMany`.
export type PocketItem = {
  url: string
  title: string
  tags: string[]
  /** Milliseconds since the epoch. */
  savedAt: number
}

export type PocketExport = {
  items: PocketItem[]
  /** Rows without a usable http(s) link; they are not sent. */
  unusable: number
  /** Earliest and latest `savedAt`, or null when no row had a date. */
  range: { from: number; to: number } | null
  tags: TagCount[]
}

export type PocketParseError = 'NOT_POCKET' | 'EMPTY'

// Pocket's export header is `title,url,time_added,tags,status`; `status`
// (unread/archive) is ignored because Webcase has no read state.
const REQUIRED_COLUMNS = ['title', 'url', 'time_added', 'tags'] as const

// Pocket's `time_added` is Unix seconds; importMany wants milliseconds.
const toMilliseconds = (raw: string | undefined): number | null => {
  const seconds = Number(raw?.trim())
  return Number.isFinite(seconds) && seconds > 0
    ? Math.round(seconds * 1000)
    : null
}

/**
 * Reads a Pocket CSV export. Rows whose link is not a usable http(s) URL
 * are counted, not sent; a row without a date is dated now rather than
 * dropped.
 */
export const parsePocketExport = (
  text: string,
  now: number,
): { export: PocketExport } | { error: PocketParseError } => {
  const [header, ...rows] = parseCsv(text)
  if (!header) return { error: 'EMPTY' }

  const names = header.map((name) => name.trim().toLowerCase())
  const index = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => [column, names.indexOf(column)]),
  ) as Record<(typeof REQUIRED_COLUMNS)[number], number>
  if (Object.values(index).some((position) => position < 0)) {
    return { error: 'NOT_POCKET' }
  }
  if (rows.length === 0) return { error: 'EMPTY' }

  const items: PocketItem[] = []
  let unusable = 0
  let from = Infinity
  let to = -Infinity

  for (const row of rows) {
    const url = row[index.url]?.trim() ?? ''
    if (!parseHttpUrl(url)) {
      unusable += 1
      continue
    }

    const savedAt = toMilliseconds(row[index.time_added])
    if (savedAt !== null) {
      from = Math.min(from, savedAt)
      to = Math.max(to, savedAt)
    }

    items.push({
      url,
      title: (row[index.title] ?? '').replace(/\s+/g, ' ').trim(),
      tags: normalizeTags((row[index.tags] ?? '').split('|')),
      savedAt: savedAt ?? now,
    })
  }

  return {
    export: {
      items,
      unusable,
      range: from <= to ? { from, to } : null,
      tags: countTags(items),
    },
  }
}
