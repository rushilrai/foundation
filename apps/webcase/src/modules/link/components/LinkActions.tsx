import type { Doc } from '@convex/_generated/dataModel'
import { IconExternalLink, IconShare2 } from '@tabler/icons-react'
import { useEffect, useState } from 'react'

import { cn } from '@/components/lib/utils'
import { Button } from '@/components/ui/button'
import { shareLink } from '../share'

type LinkActionsProps = {
  link: Doc<'links'>
  /** The Open link anchor, which takes focus when the sheet opens. */
  openRef: React.Ref<HTMLAnchorElement>
}

/** Open the page, or share it (copy where there is no share sheet). */
export const LinkActions = ({ link, openRef }: LinkActionsProps) => {
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(
    null,
  )

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 2500)
    return () => clearTimeout(timer)
  }, [notice])

  const share = async () => {
    const outcome = await shareLink(link)
    if (outcome === 'copied') setNotice({ text: 'Link copied', error: false })
    else if (outcome === 'failed') {
      setNotice({ text: 'Couldn’t copy the link.', error: true })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          className="h-11 flex-1 px-5"
          nativeButton={false}
          render={
            <a
              ref={openRef}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Open link
          <IconExternalLink data-icon="inline-end" aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </Button>
        <Button variant="outline" className="h-11 gap-1.5 px-4" onClick={share}>
          <IconShare2 className="size-4" aria-hidden />
          Share
        </Button>
      </div>
      <p
        role="status"
        className={cn(
          'h-4 text-center font-mono text-2xs',
          notice?.error ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {notice?.text}
      </p>
    </div>
  )
}
