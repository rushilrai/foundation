import { parsePocketExport, type PocketExport } from './pocket'

// Far larger than any Pocket export of a few thousand links.
const MAX_FILE_BYTES = 20 * 1024 * 1024

type ReadError = 'NOT_POCKET' | 'EMPTY' | 'NO_LINKS' | 'TOO_BIG' | 'UNREADABLE'

const READ_MESSAGES: Record<ReadError, string> = {
  NOT_POCKET:
    'This isn’t a Pocket export. Its first line should be title,url,time_added,tags,status.',
  EMPTY: 'This file has no links in it.',
  NO_LINKS: 'None of the rows in this file has a usable link.',
  TOO_BIG: 'This file is too big to be a Pocket export.',
  UNREADABLE: 'Couldn’t read this file. Choose the CSV from your export.',
}

/**
 * Reads a chosen file as a Pocket export, in the browser. Fails with a
 * message to show when it is too big, unreadable, not an export, or has no
 * usable link.
 */
export const readPocketFile = async (
  file: File,
  now: number,
): Promise<{ export: PocketExport } | { error: string }> => {
  const fail = (code: ReadError) => ({ error: READ_MESSAGES[code] })

  if (file.size > MAX_FILE_BYTES) return fail('TOO_BIG')

  let text: string
  try {
    text = await file.text()
  } catch (error) {
    console.error('Error reading the import file', error)
    return fail('UNREADABLE')
  }

  const parsed = parsePocketExport(text, now)
  if ('error' in parsed) return fail(parsed.error)
  if (parsed.export.items.length === 0) return fail('NO_LINKS')

  return parsed
}
