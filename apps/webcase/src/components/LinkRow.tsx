import type { Doc } from '@convex/_generated/dataModel'

import { formatSavedDate } from '@/components/lib/dates'
import { cn } from '@/components/lib/utils'
import { Tag } from '@/components/Tag'
import { Skeleton } from '@/components/ui/skeleton'

const MAX_VISIBLE_TAGS = 6

/** The `links` fields a row shows; spread a `links` document straight in. */
type LinkRowFields = Pick<
  Doc<'links'>,
  'title' | 'url' | 'domain' | 'summary' | 'summaryStatus' | 'tags' | 'savedAt'
>

type LinkRowProps = LinkRowFields & {
  /**
   * The current time (ms) and IANA zone the date is shown in. Both are
   * required so the server and the browser render the same day and year:
   * pass values both sides agree on, or render the list on the client only.
   */
  now: number
  timeZone: string
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
 * A `pending` summary shows a shimmer; a `failed` one shows nothing.
 */
export const LinkRow = ({
  title,
  url,
  domain,
  summary,
  summaryStatus,
  tags,
  savedAt,
  now,
  timeZone,
  onSelect,
  titleOpensLink = false,
  onTagSelect,
  trailing,
  className,
}: LinkRowProps) => {
  const date = new Date(savedAt)
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS)
  const hiddenTags = tags.length - visibleTags.length

  return (
    <article className={cn('relative border-b py-4', className)}>
      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Details for ${title}`}
          className="absolute inset-y-0 -right-4 -left-4 outline-hidden transition-colors hover:bg-foreground/[0.025] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring focus-visible:outline-solid active:bg-foreground/5 sm:-right-3 sm:-left-3 sm:rounded-lg"
        />
      )}

      <div className="flex items-start gap-3">
        <h3
          className={cn(
            'min-w-0 flex-1 font-serif text-base leading-tight font-semibold tracking-[-0.005em] text-pretty wrap-anywhere text-foreground',
            !titleOpensLink && 'line-clamp-2',
          )}
        >
          {titleOpensLink ? (
            // The clamp sits on the inner span, so nothing clips the link's
            // ::after, which stretches the touch target to 44px tall: opening
            // the page is the row's main action, and a near miss would open
            // the details instead.
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-block max-w-full rounded-sm align-top underline-offset-[3px] outline-hidden after:absolute after:inset-x-0 after:top-1/2 after:h-[max(100%,2.75rem)] after:-translate-y-1/2 hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
            >
              <span className="line-clamp-2">{title}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            title
          )}
        </h3>
        {trailing && (
          <div className="relative z-10 -my-2 shrink-0">{trailing}</div>
        )}
      </div>

      {summaryStatus === 'pending' ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <span className="sr-only">Summary on its way</span>
          <Skeleton className="h-2.5 w-11/12 rounded-full" />
          <Skeleton className="h-2.5 w-2/3 rounded-full" />
        </div>
      ) : (
        summary && (
          <p className="mt-1 line-clamp-2 text-[0.8rem] leading-normal wrap-anywhere text-muted-foreground">
            {summary}
          </p>
        )
      )}

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="max-w-full truncate font-mono text-[0.6875rem] text-muted-foreground">
          {domain}
        </span>
        {visibleTags.map((tag) =>
          onTagSelect ? (
            <button
              key={tag}
              type="button"
              onClick={() => onTagSelect(tag)}
              // The visible tag stays small; the ::after box gives a touch
              // target of at least 44×44 so a near miss doesn't open the row.
              className="relative z-10 -my-2 inline-flex h-8 items-center rounded-sm outline-hidden after:absolute after:top-1/2 after:left-1/2 after:h-11 after:w-[calc(100%+0.75rem)] after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid hover:[&_span]:text-foreground"
            >
              <span className="sr-only">Filter by </span>
              <Tag name={tag} />
            </button>
          ) : (
            <Tag key={tag} name={tag} />
          ),
        )}
        {hiddenTags > 0 && (
          <span className="font-mono text-[0.6875rem] text-muted-foreground">
            +{hiddenTags}
            <span className="sr-only"> more tags</span>
          </span>
        )}
        <time
          dateTime={date.toISOString()}
          className="ml-auto shrink-0 pl-2 font-mono text-[0.6875rem] text-faint-foreground"
        >
          {formatSavedDate(date, { now, timeZone })}
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
