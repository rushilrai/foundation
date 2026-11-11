import { DAILY_IMPORT_LIMIT } from '@shared/limits'
import { Link, useBlocker } from '@tanstack/react-router'

import { InlineError } from '@/components/EmptyState'
import { formatMonthYear } from '@/components/lib/dates'
import { SectionLabel } from '@/components/SectionLabel'
import { Tag } from '@/components/Tag'
import { Button } from '@/components/ui/button'
import { useClientDates } from '@/hooks/useClientDates'
import { useImportRun, type ImportTotals } from '@/modules/import/mutations'
import type { PocketExport } from '@/modules/import/pocket'
import { enrichEstimate } from '@/modules/import/utils'

const TOP_TAGS = 12

type ImportPanelProps = {
  name: string
  data: PocketExport
  onChooseAnother: () => void
}

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString('en')} ${count === 1 ? one : many}`

const SavedRange = ({ from, to }: { from: number; to: number }) => {
  // Chosen files are only read in the browser, so the device zone is known.
  const dates = useClientDates()
  if (!dates) return null

  const start = formatMonthYear(from, dates)
  const end = formatMonthYear(to, dates)
  return (
    <p className="mt-1 text-sm text-muted-foreground">
      {start === end ? `Saved in ${start}` : `Saved ${start} to ${end}`}
    </p>
  )
}

// What was found, then the import itself: progress, a stop with resume,
// and the totals.
export const ImportPanel = ({
  name,
  data,
  onChooseAnother,
}: ImportPanelProps) => {
  const { run, start } = useImportRun(data.items)
  const running = run.status === 'running'
  const total = data.items.length

  // In-app navigation asks first; closing or reloading the tab gets the
  // browser's own warning.
  useBlocker({
    shouldBlockFn: () =>
      !window.confirm('The import is still running. Leave anyway?'),
    enableBeforeUnload: () => running,
    disabled: !running,
  })

  if (run.status === 'finished') {
    return (
      <ImportDone
        totals={run.totals}
        unusable={data.unusable}
        onChooseAnother={onChooseAnother}
      />
    )
  }

  const sent = run.status === 'idle' ? 0 : run.sent
  const percent = Math.round((sent / total) * 100)

  return (
    <div className="mt-8 flex flex-col pb-10">
      <p className="truncate font-mono text-xs text-muted-foreground">{name}</p>
      <p className="mt-2 font-serif text-3xl font-medium tabular-nums">
        {plural(total, 'link')}
      </p>
      {data.range && <SavedRange {...data.range} />}
      {data.unusable > 0 && (
        <p className="mt-1 text-sm text-muted-foreground">
          {plural(data.unusable, 'row')} without a usable link will be left out.
        </p>
      )}
      {total > DAILY_IMPORT_LIMIT && (
        <p className="mt-3 text-sm text-foreground">
          Webcase imports up to {DAILY_IMPORT_LIMIT.toLocaleString('en')} links
          a day. The import stops there; come back tomorrow to resume it.
        </p>
      )}

      {data.tags.length > 0 && (
        <section className="mt-8">
          <SectionLabel as="h2">Most used tags</SectionLabel>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2.5">
            {data.tags.slice(0, TOP_TAGS).map(({ tag, count }) => (
              <li key={tag} className="inline-flex items-center gap-1.5">
                <Tag name={tag} className="text-sm" />
                <span className="font-mono text-2xs text-faint-foreground tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
          {data.tags.length > TOP_TAGS && (
            <p className="mt-3 text-xs text-muted-foreground">
              and {plural(data.tags.length - TOP_TAGS, 'more tag')}
            </p>
          )}
        </section>
      )}

      <div className="mt-10 flex flex-col gap-3">
        {run.status !== 'idle' && (
          <div className="flex flex-col gap-2">
            <div
              role="progressbar"
              aria-label="Import progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={sent}
              className="h-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p
              className="font-mono text-xs text-muted-foreground tabular-nums"
              aria-live="polite"
            >
              {running ? 'Importing… ' : 'Stopped at '}
              {sent.toLocaleString('en')} of {total.toLocaleString('en')}
            </p>
          </div>
        )}

        {run.status === 'stopped' && <InlineError>{run.error}</InlineError>}

        <Button
          size="lg"
          className="h-12 text-md"
          disabled={running}
          onClick={() => void start()}
        >
          {running
            ? 'Importing…'
            : run.status === 'stopped'
              ? 'Resume import'
              : `Import ${plural(total, 'link')}`}
        </Button>
        {!running && (
          <Button
            variant="ghost"
            className="h-11 text-muted-foreground"
            onClick={onChooseAnother}
          >
            Choose another file
          </Button>
        )}
      </div>
    </div>
  )
}

const ImportDone = ({
  totals,
  unusable,
  onChooseAnother,
}: {
  totals: ImportTotals
  unusable: number
  onChooseAnother: () => void
}) => {
  const invalid = totals.invalid + unusable

  return (
    <div className="mt-8 flex flex-col pb-10" role="status">
      <p className="font-serif text-3xl font-medium tabular-nums">
        {totals.imported > 0
          ? `Imported ${plural(totals.imported, 'link')}.`
          : 'Nothing new to import.'}
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground empty:hidden">
        {totals.skipped > 0 && (
          <li>
            {plural(totals.skipped, 'link was', 'links were')} already in your
            library, or listed twice.
          </li>
        )}
        {invalid > 0 && (
          <li>
            {plural(invalid, 'row')} couldn’t be used: the link or date was
            broken.
          </li>
        )}
      </ul>
      {totals.imported > 0 && (
        <p className="mt-6 text-sm text-pretty text-foreground">
          Titles, previews and summaries fill in{' '}
          {enrichEstimate(totals.imported)}. You can use your library meanwhile.
        </p>
      )}

      <div className="mt-10 flex flex-col gap-3">
        <Button
          size="lg"
          className="h-12 text-md"
          nativeButton={false}
          render={<Link to="/" />}
        >
          Go to your library
        </Button>
        <Button
          variant="ghost"
          className="h-11 text-muted-foreground"
          onClick={onChooseAnother}
        >
          Import another file
        </Button>
      </div>
    </div>
  )
}
