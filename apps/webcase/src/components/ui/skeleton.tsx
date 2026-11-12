import { cn } from '@/components/lib/utils'

// A quiet placeholder block; sweeps unless the visitor prefers reduced motion.
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('skeleton-sweep rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
