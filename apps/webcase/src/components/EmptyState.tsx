import { cn } from '@/components/lib/utils'

type EmptyStateProps = {
  /** One serif italic line, e.g. "No links yet." */
  title: React.ReactNode
  description?: React.ReactNode
  /** e.g. an Add link or Try again button. */
  action?: React.ReactNode
  /** `error` announces itself and colours the line destructive. */
  tone?: 'default' | 'error'
  className?: string
}

/** A quiet, centred placeholder for an empty list, no results, or a failed load. */
export const EmptyState = ({
  title,
  description,
  action,
  tone = 'default',
  className,
}: EmptyStateProps) => {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex flex-col items-center px-4 py-20 text-center',
        className,
      )}
    >
      <p
        className={cn(
          'font-serif text-xl text-balance italic',
          tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {title}
      </p>
      {description && (
        <p className="mt-2 max-w-xs text-sm text-balance text-faint-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

type InlineErrorProps = {
  children: React.ReactNode
  className?: string
}

/** A short error under a field or action. Renders nothing without children. */
export const InlineError = ({ children, className }: InlineErrorProps) => {
  if (!children) return null

  return (
    <p role="alert" className={cn('text-sm text-destructive', className)}>
      {children}
    </p>
  )
}
