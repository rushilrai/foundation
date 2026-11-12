import { cn } from '@/components/lib/utils'

type SectionLabelProps<T extends React.ElementType> = {
  /** The element to render, e.g. `h2`, `h3` or `label`. */
  as?: T
  className?: string
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className'>

/** The tiny letter-spaced caps over a section: month names, "Summary", "Tags". */
export const SectionLabel = <T extends React.ElementType = 'h2'>({
  as,
  className,
  ...props
}: SectionLabelProps<T>) => {
  const Component: React.ElementType = as ?? 'h2'

  return (
    <Component
      className={cn(
        'text-2xs font-medium tracking-[0.18em] text-muted-foreground uppercase',
        className,
      )}
      {...props}
    />
  )
}
