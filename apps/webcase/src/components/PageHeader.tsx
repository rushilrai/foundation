import { IconChevronLeft } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'

type PageHeaderProps = {
  title: React.ReactNode
  /** The back link, e.g. `<Link to="/" />`; it gets the button's look. */
  back: React.ReactElement
  backLabel?: string
  /** The page heading, e.g. to move focus to it. */
  headingRef?: React.Ref<HTMLHeadingElement>
}

/** A page away from the library: `‹ Library` on top, then the serif title. */
export const PageHeader = ({
  title,
  back,
  backLabel = 'Library',
  headingRef,
}: PageHeaderProps) => {
  return (
    <>
      <header className="flex h-14 items-center">
        <Button
          variant="ghost"
          className="-ml-3 h-11 px-3 text-muted-foreground"
          nativeButton={false}
          render={back}
        >
          <IconChevronLeft data-icon="inline-start" aria-hidden />
          {backLabel}
        </Button>
      </header>

      <h1
        ref={headingRef}
        // Focusable from script only, so focus has somewhere to go when the
        // part of the page that held it is replaced.
        tabIndex={-1}
        className="mt-2 font-serif text-2xl font-medium outline-hidden"
      >
        {title}
      </h1>
    </>
  )
}
