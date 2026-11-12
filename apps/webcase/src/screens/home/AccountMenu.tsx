import { Menu } from '@base-ui/react/menu'
import { IconFileImport, IconLogout, IconUserCircle } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { FROM_LIBRARY } from '@/modules/link/hooks'

const ITEM_CLASS =
  'flex h-11 cursor-default items-center gap-2.5 rounded-lg px-3 text-sm text-foreground outline-hidden select-none data-highlighted:bg-muted data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground'

type AccountMenuProps = {
  email: string | null
  onSignOut: () => void
  signingOut: boolean
}

/** A quiet icon in the header: who is signed in, import, sign out. */
export const AccountMenu = ({
  email,
  onSignOut,
  signingOut,
}: AccountMenuProps) => {
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2.5 size-11 text-muted-foreground"
          />
        }
      >
        <IconUserCircle className="size-5.5" stroke={1.5} aria-hidden />
        <span className="sr-only">Account</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-hidden"
          side="bottom"
          align="end"
          sideOffset={4}
        >
          <Menu.Popup className="w-72 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 shadow-foreground/10 ring-foreground/10 outline-hidden transition-[scale,opacity] duration-100 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {email && (
              <>
                <div className="px-3 pt-2 pb-2.5">
                  <p className="text-2xs text-muted-foreground">Signed in as</p>
                  <p className="truncate font-mono text-xs text-foreground">
                    {email}
                  </p>
                </div>
                <Menu.Separator className="mx-1 my-1 h-px bg-border" />
              </>
            )}
            <Menu.LinkItem
              closeOnClick
              className={ITEM_CLASS}
              render={<Link to="/import" state={FROM_LIBRARY} />}
            >
              <IconFileImport aria-hidden />
              Import from Pocket
            </Menu.LinkItem>
            <Menu.Item
              className={ITEM_CLASS}
              disabled={signingOut}
              onClick={onSignOut}
            >
              <IconLogout aria-hidden />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
