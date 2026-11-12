import { IconFileTypeCsv } from '@tabler/icons-react'
import { useRef, useState } from 'react'

import { InlineError } from '@/components/EmptyState'
import { cn } from '@/components/lib/utils'
import { Button } from '@/components/ui/button'

type FilePickerProps = {
  onFile: (file: File) => void
  busy: boolean
  error: string | null
}

// A file button, and on desktop a drop target around it.
export const FilePicker = ({ onFile, busy, error }: FilePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div className="mt-8 flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
          setDragging(true)
        }}
        onDragLeave={(event) => {
          // Moving onto a child fires dragleave on the parent; ignore that.
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file && !busy) onFile(file)
        }}
        className={cn(
          'flex flex-col items-center gap-3 rounded-xl border border-dashed border-input px-4 py-10 text-center transition-colors',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <IconFileTypeCsv
          className="size-8 text-muted-foreground"
          stroke={1.5}
          aria-hidden
        />
        <Button
          type="button"
          size="lg"
          className="h-12 px-6 text-md"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? 'Reading…' : 'Choose the CSV file'}
        </Button>
        <p className="hidden text-sm text-muted-foreground pointer-fine:block">
          or drop it here
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Cleared, so choosing the same file again still fires a change.
            event.target.value = ''
            if (file) onFile(file)
          }}
        />
      </div>
      <InlineError>{error}</InlineError>
    </div>
  )
}
