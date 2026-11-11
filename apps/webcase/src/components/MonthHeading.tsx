import { cn } from '@/components/lib/utils'

type MonthHeadingProps = {
  children: React.ReactNode
  className?: string
}

/** A month label over a run of links: tiny, letter-spaced caps. */
export const MonthHeading = ({ children, className }: MonthHeadingProps) => {
  return (
    <h2
      className={cn(
        'pt-8 pb-1 text-[0.6875rem] font-medium tracking-[0.18em] text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </h2>
  )
}
