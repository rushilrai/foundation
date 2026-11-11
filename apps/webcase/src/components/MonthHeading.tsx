import { cn } from '@/components/lib/utils'
import { SectionLabel } from '@/components/SectionLabel'

type MonthHeadingProps = {
  children: React.ReactNode
  className?: string
}

/** A month label over a run of links: tiny, letter-spaced caps. */
export const MonthHeading = ({ children, className }: MonthHeadingProps) => {
  return (
    <SectionLabel as="h2" className={cn('pt-8 pb-1', className)}>
      {children}
    </SectionLabel>
  )
}
