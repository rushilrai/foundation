import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { readPocketFile } from '@/modules/import/file'
import type { PocketExport } from '@/modules/import/pocket'
import { useReturnToLibrary } from '@/modules/link/hooks'
import { FilePicker } from './FilePicker'
import { ImportPanel } from './ImportPanel'

type Chosen = { id: number; name: string; data: PocketExport }

// A one-off import of a Pocket export. The CSV is read in the browser and
// sent in batches; nothing is uploaded as a file.
export const ImportScreen = () => {
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const { onLibraryLinkClick } = useReturnToLibrary()

  const readFile = async (file: File) => {
    setError(null)
    setReading(true)
    const result = await readPocketFile(file, Date.now())
    setReading(false)
    if ('error' in result) setError(result.error)
    else setChosen({ id: Date.now(), name: file.name, data: result.export })
  }

  return (
    <main className="page-column flex min-h-dvh flex-col">
      <PageHeader
        title="Import from Pocket"
        back={<Link to="/" onClick={onLibraryLinkClick} />}
      />

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
