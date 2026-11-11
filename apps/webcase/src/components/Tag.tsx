import { tagDotClass } from '@/components/lib/tags'
import { cn } from '@/components/lib/utils'

type TagDotProps = {
  name: string
  className?: string
}

/** The tag's colour as a small dot; decorative, so it is hidden from screen readers. */
export const TagDot = ({ name, className }: TagDotProps) => {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        tagDotClass(name),
        className,
      )}
    />
  )
}

type TagProps = {
  name: string
  className?: string
}

/** A dot and the lowercase name, as tags appear in rows and previews. */
export const Tag = ({ name, className }: TagProps) => {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 text-xs text-foreground/80 lowercase',
        className,
      )}
    >
      <TagDot name={name} />
      <span className="truncate">{name}</span>
    </span>
  )
}
