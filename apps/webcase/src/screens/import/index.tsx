import { IconChevronLeft } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { parsePocketExport, type PocketExport } from '@/modules/import/pocket'
import { FilePicker } from './FilePicker'
import { ImportPanel } from './ImportPanel'

// Far larger than any Pocket export of a few thousand links.
const MAX_FILE_BYTES = 20 * 1024 * 1024

const PARSE_MESSAGES: Record<string, string> = {
  NOT_POCKET:
    'This isn’t a Pocket export. Its first line should be title,url,time_added,tags,status.',
  EMPTY: 'This file has no links in it.',
  NO_LINKS: 'None of the rows in this file has a usable link.',
  TOO_BIG: 'This file is too big to be a Pocket export.',
  UNREADABLE: 'Couldn’t read this file. Choose the CSV from your export.',
}

type Chosen = { id: number; name: string; data: PocketExport }

// A one-off import of a Pocket export. The CSV is read in the browser and
// sent in batches; nothing is uploaded as a file.
export const ImportScreen = () => {
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  const readFile = async (file: File) => {
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError(PARSE_MESSAGES.TOO_BIG)
      return
    }

    setReading(true)
    try {
      const parsed = parsePocketExport(await file.text(), Date.now())
      if ('error' in parsed) {
        setError(PARSE_MESSAGES[parsed.error])
      } else if (parsed.export.items.length === 0) {
        setError(PARSE_MESSAGES.NO_LINKS)
      } else {
        setChosen({ id: Date.now(), name: file.name, data: parsed.export })
      }
    } catch (readError) {
      console.error('Error reading the import file', readError)
      setError(PARSE_MESSAGES.UNREADABLE)
    } finally {
      setReading(false)
    }
  }

  return (
    <main className="page-column flex min-h-dvh flex-col">
      <header className="flex h-14 items-center">
        <Button
          variant="ghost"
          className="-ml-3 h-11 px-3 text-muted-foreground"
          nativeButton={false}
          render={<Link to="/" />}
        >
          <IconChevronLeft data-icon="inline-start" aria-hidden />
          Library
        </Button>
      </header>

      <h1 className="mt-2 font-serif text-2xl font-medium">
        Import from Pocket
      </h1>

      {chosen ? (
        <ImportPanel
          key={chosen.id}
          name={chosen.name}
          data={chosen.data}
          onChooseAnother={() => setChosen(null)}
        />
      ) : (
        <>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">
            Bring over the links from your Pocket export, with their tags and
            the dates you saved them. Choose the CSV file from the export; if it
            came as a .zip, unzip it first.
          </p>
          <FilePicker
            onFile={(file) => void readFile(file)}
            busy={reading}
            error={error}
          />
        </>
      )}
    </main>
  )
}
