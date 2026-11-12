import type { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { SUMMARY_STUCK_AFTER_MS } from '@shared/limits'
import { IconRefresh } from '@tabler/icons-react'
import { useState } from 'react'

import { InlineError } from '@/components/EmptyState'
import { cn } from '@/components/lib/utils'
import { SectionLabel } from '@/components/SectionLabel'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { messageFor, MESSAGES, type ErrorMessages } from '../errors'
import { useRetrySummary } from '../mutations'

const RETRY_ERRORS: ErrorMessages<
  typeof api.modules.link.mutations.retrySummary
> = {
  UNAUTHORIZED: MESSAGES.UNAUTHORIZED,
  NOT_FOUND: MESSAGES.NOT_FOUND,
  NOT_RETRYABLE: 'The summary is already on its way.',
  RATE_LIMITED: 'Too many tries for now. Try again later.',
}

/** The summary, a shimmer while it is on its way, or a retry when it failed. */
export const LinkSummary = ({ link }: { link: Doc<'links'> }) => {
  const retrySummary = useRetrySummary()
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Read per render; the sheet re-renders whenever the link changes.
  const now = Date.now()
  const stuck =
    link.summaryStatus === 'pending' &&
    link.summaryDueAt !== undefined &&
    link.summaryDueAt < now - SUMMARY_STUCK_AFTER_MS
  const canRetry = link.summaryStatus === 'failed' || stuck

  const retry = async () => {
    setRetrying(true)
    setError(null)
    try {
      const result = await retrySummary({ linkId: link._id })
      if ('error' in result) setError(messageFor(RETRY_ERRORS, result.error))
    } catch (caught) {
      console.error('Error retrying the summary', caught)
      setError(MESSAGES.NETWORK)
    } finally {
      setRetrying(false)
    }
  }

  if (link.summaryStatus === 'ready' && !link.summary) return null

  return (
    <section className="flex flex-col gap-2">
      <SectionLabel as="h3">Summary</SectionLabel>

      {link.summaryStatus === 'ready' ? (
        <p className="text-md leading-relaxed text-pretty wrap-anywhere text-foreground">
          {link.summary}
        </p>
      ) : link.summaryStatus === 'pending' && !stuck ? (
        <div className="flex flex-col gap-2 py-1" role="status">
          <span className="sr-only">Summary on its way</span>
          <Skeleton className="h-3 w-full rounded-full" />
          <Skeleton className="h-3 w-11/12 rounded-full" />
          <Skeleton className="h-3 w-2/3 rounded-full" />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {stuck ? 'The summary is taking a while.' : 'Couldn’t summarise.'}
          </p>
          {canRetry && (
            <Button
              variant="ghost"
              className="-mr-3 h-11 gap-1.5 px-3 text-primary hover:text-primary"
              disabled={retrying}
              onClick={retry}
            >
              <IconRefresh
                className={cn(
                  'size-4',
                  retrying && 'animate-spin motion-reduce:animate-none',
                )}
                aria-hidden
              />
              {retrying ? 'Retrying…' : 'Retry'}
            </Button>
          )}
        </div>
      )}

      <InlineError>{error}</InlineError>
    </section>
  )
}
