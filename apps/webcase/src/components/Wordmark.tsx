import { cn } from '@/components/lib/utils'

type WordmarkProps = {
  className?: string
}

export const Wordmark = ({ className }: WordmarkProps) => {
  return (
    <span
      className={cn(
        'font-serif text-2xl font-semibold tracking-tight text-foreground italic',
        className,
      )}
    >
      Webcase
    </span>
  )
}
