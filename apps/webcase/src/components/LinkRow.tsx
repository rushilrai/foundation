import { formatSavedDate } from '@/components/lib/dates'
import { cn } from '@/components/lib/utils'
import { Tag } from '@/components/Tag'
import { Skeleton } from '@/components/ui/skeleton'

type LinkRowProps = {
  title: string
  url: string
  /** Shown in mono under the summary, e.g. `maps.google.com`. */
  domain: string
  summary?: string | null
  /** The summary is still being written: shows a shimmer line instead. */
  summaryPending?: boolean
  tags: readonly string[]
  savedAt: Date | number
  /** Pass the zone the server rendered with, so the date hydrates identically. */
  timeZone?: string
  /** Pressing the row (anywhere but a link or tag): opens the detail sheet. */
  onSelect?: () => void
  /** When set, the title is a real link to `url` that opens in a new tab. */
  titleOpensLink?: boolean
  /** When set, tags become buttons (e.g. to filter by that tag). */
  onTagSelect?: (tag: string) => void
  /** Trailing slot beside the title, e.g. a menu button. Rendered above the row's press area. */
  trailing?: React.ReactNode
  className?: string
}

/**
 * One saved link in the library: serif title, grey summary, then a mono domain and
 * the tags. Hairline-separated, no card. The whole row presses `onSelect`;
 * links and tag buttons inside it stay independently clickable.
 */
export const LinkRow = ({
  title,
  url,
  domain,
  summary,
  summaryPending = false,
  tags,
  savedAt,
  timeZone,
  onSelect,
  titleOpensLink = false,
  onTagSelect,
  trailing,
  className,
}: LinkRowProps) => {
  const date = new Date(savedAt)

  return (
    <article className={cn('relative border-b py-4', className)}>
      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          aria-label={title}
          className="absolute inset-y-0 -right-4 -left-4 outline-hidden transition-colors hover:bg-foreground/[0.025] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring focus-visible:outline-solid active:bg-foreground/5 sm:-right-3 sm:-left-3 sm:rounded-lg"
        />
      )}

      <div className="flex items-start gap-3">
        <h3 className="line-clamp-2 min-w-0 flex-1 font-serif text-base leading-tight font-semibold tracking-[-0.005em] text-pretty text-foreground">
          {titleOpensLink ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 rounded-sm underline-offset-[3px] outline-hidden hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
            >
              {title}
            </a>
          ) : (
            title
          )}
        </h3>
        {trailing && (
          <div className="relative z-10 -my-2 shrink-0">{trailing}</div>
        )}
      </div>

      {summaryPending ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <span className="sr-only">Summary on its way</span>
          <Skeleton className="h-2.5 w-11/12 rounded-full" />
          <Skeleton className="h-2.5 w-2/3 rounded-full" />
        </div>
      ) : (
        summary && (
          <p className="mt-1 line-clamp-2 text-[0.8rem] leading-normal text-muted-foreground">
            {summary}
          </p>
        )
      )}

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="max-w-full truncate font-mono text-[0.6875rem] text-muted-foreground">
          {domain}
        </span>
        {tags.map((tag) =>
          onTagSelect ? (
            <button
              key={tag}
              type="button"
              onClick={() => onTagSelect(tag)}
              className="relative z-10 -my-2 inline-flex h-8 items-center rounded-sm outline-hidden focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid hover:[&_span]:text-foreground"
            >
              <span className="sr-only">Filter by </span>
              <Tag name={tag} />
            </button>
          ) : (
            <Tag key={tag} name={tag} />
          ),
        )}
        <time
          dateTime={date.toISOString()}
          className="ml-auto shrink-0 pl-2 font-mono text-[0.6875rem] text-faint-foreground"
        >
          {formatSavedDate(date, { timeZone })}
        </time>
      </div>
    </article>
  )
}

/** A placeholder row while the list loads. */
export const LinkRowSkeleton = ({ className }: { className?: string }) => {
  return (
    <div className={cn('border-b py-4', className)} aria-hidden>
      <Skeleton className="h-4 w-4/5 rounded-full" />
      <Skeleton className="mt-2.5 h-2.5 w-full rounded-full" />
      <Skeleton className="mt-3 h-2 w-1/3 rounded-full" />
    </div>
  )
}
