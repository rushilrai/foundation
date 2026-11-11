import { useState } from 'react'

import { cn } from '@/components/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type LinkPreviewCardProps = {
  title: string
  domain: string
  description?: string | null
  /** The page's preview image; dropped cleanly if it fails to load. */
  image?: string | null
  className?: string
}

/** What a link will look like once saved: image, mono domain, serif title, description. */
export const LinkPreviewCard = ({
  title,
  domain,
  description,
  image,
  className,
}: LinkPreviewCardProps) => {
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const showImage = Boolean(image) && failedImage !== image

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl bg-card ring-1 ring-border',
        className,
      )}
    >
      {showImage && image && (
        <div className="aspect-video overflow-hidden border-b bg-muted">
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            // An image that failed before hydration never fires onError, so check on mount too.
            ref={(element) => {
              if (element?.complete && element.naturalWidth === 0) {
                setFailedImage(image)
              }
            }}
            onError={() => setFailedImage(image)}
          />
        </div>
      )}
      <div className="flex flex-col gap-1 p-4">
        <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
          {domain}
        </span>
        <p className="line-clamp-3 font-serif text-lg leading-snug font-semibold tracking-tight text-pretty text-foreground">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 line-clamp-3 text-[0.8125rem] leading-normal text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

/** The preview while the page is being read. */
export const LinkPreviewCardSkeleton = ({
  withImage = true,
  className,
}: {
  withImage?: boolean
  className?: string
}) => {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl bg-card ring-1 ring-border',
        className,
      )}
    >
      <span className="sr-only" role="status">
        Reading the page…
      </span>
      {withImage && <Skeleton className="aspect-video rounded-none" />}
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-2.5 w-28 rounded-full" />
        <Skeleton className="mt-1 h-4 w-11/12 rounded-full" />
        <Skeleton className="h-4 w-3/5 rounded-full" />
        <Skeleton className="mt-1 h-2.5 w-full rounded-full" />
      </div>
    </div>
  )
}
