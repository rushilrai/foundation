import { cn } from '@/components/lib/utils'
import { Wordmark } from '@/components/Wordmark'

type LibraryHeaderProps = {
  /** Total links; hidden while unknown. */
  count?: number | null
  /** After the count, e.g. an account menu. */
  actions?: React.ReactNode
  className?: string
}

/** The top of Home: the wordmark, and a small mono count on the right. */
export const LibraryHeader = ({
  count,
  actions,
  className,
}: LibraryHeaderProps) => {
  return (
    <header
      className={cn(
        'flex items-center justify-between gap-4 pt-5 pb-2',
        className,
      )}
    >
      <h1>
        <Wordmark />
      </h1>
      <div className="flex items-center gap-2">
        {count != null && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {count.toLocaleString('en')} {count === 1 ? 'link' : 'links'}
          </span>
        )}
        {actions}
      </div>
    </header>
  )
}
