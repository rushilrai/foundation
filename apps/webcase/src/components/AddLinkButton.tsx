import { IconPlus } from '@tabler/icons-react'

import { cn } from '@/components/lib/utils'
import { Button } from '@/components/ui/button'

type AddLinkButtonProps = React.ComponentProps<typeof Button> & {
  label?: string
}

/**
 * The floating cobalt pill, bottom right, above the home indicator.
 * Takes Button props: `onClick`, or `render={<Link to="/save" />}` with `nativeButton={false}`.
 * Give the list under it `fab-clearance` so the last row stays reachable.
 */
export const AddLinkButton = ({
  label = 'Add link',
  className,
  ...props
}: AddLinkButtonProps) => {
  return (
    <Button
      className={cn(
        'fab-position h-12 gap-1.5 rounded-full pr-5 pl-4 text-[0.9375rem] shadow-lg shadow-primary/30 hover:bg-primary/90 focus-visible:ring-offset-2 active:scale-[0.98]',
        className,
      )}
      {...props}
    >
      <IconPlus className="size-4.5" stroke={2.25} aria-hidden />
      {label}
    </Button>
  )
}
