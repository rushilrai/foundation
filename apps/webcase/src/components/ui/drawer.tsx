'use client'

import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import { IconX } from '@tabler/icons-react'
import * as React from 'react'

import { cn } from '@/components/lib/utils'
import { Button } from '@/components/ui/button'

// The app's sheet. On phones it rises from the bottom and swipes down to close;
// from `sm` up it sits as a centred panel. It keeps fields clear of the software
// keyboard (VirtualKeyboardProvider), so it suits the save and edit forms.

function Drawer({
  children,
  ...props
}: Omit<DrawerPrimitive.Root.Props, 'children'> & {
  children?: React.ReactNode
}) {
  return (
    <DrawerPrimitive.Root data-slot="drawer" {...props}>
      <DrawerPrimitive.VirtualKeyboardProvider>
        {children}
      </DrawerPrimitive.VirtualKeyboardProvider>
    </DrawerPrimitive.Root>
  )
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerBackdrop({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="drawer-backdrop"
      className={cn(
        'fixed inset-0 z-50 min-h-dvh bg-foreground/25 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 supports-[-webkit-touch-callout:none]:absolute',
        className,
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerBackdrop />
      <DrawerPrimitive.Viewport
        data-slot="drawer-viewport"
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      >
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            // Phone: a bottom sheet that follows the finger and slides away.
            'relative flex max-h-[calc(100dvh-2.5rem)] w-full flex-col rounded-t-2xl bg-popover pb-[env(safe-area-inset-bottom)] text-popover-foreground shadow-2xl shadow-foreground/20 outline-none',
            'translate-y-[var(--drawer-swipe-movement-y,0px)] transition-[translate,opacity] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:translate-y-full data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*400ms)] data-starting-style:translate-y-full data-swiping:duration-0 data-swiping:select-none',
            // Desktop: a centred panel that fades in.
            'sm:max-h-[min(85dvh,48rem)] sm:max-w-lg sm:rounded-2xl sm:pb-0 sm:ring-1 sm:ring-foreground/10 sm:data-ending-style:translate-y-3 sm:data-ending-style:opacity-0 sm:data-starting-style:translate-y-3 sm:data-starting-style:opacity-0',
            className,
          )}
          {...props}
        >
          <div
            aria-hidden
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-foreground/15 sm:hidden"
          />
          {children}
          {showCloseButton && (
            <DrawerPrimitive.Close
              data-slot="drawer-close"
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 size-11 text-muted-foreground sm:top-4 sm:right-4 sm:size-9"
                />
              }
            >
              <IconX className="size-5" />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          )}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        'flex shrink-0 flex-col gap-1 px-5 pt-3 pr-16 pb-3 sm:px-6 sm:pt-6',
        className,
      )}
      {...props}
    />
  )
}

/**
 * The scrolling middle, a column of blocks that keep their height (they never squash
 * to fit). Text in it can be selected with a mouse without starting a swipe.
 */
function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-body"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 pb-5 *:shrink-0 sm:px-6 sm:pb-6',
        className,
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        'flex shrink-0 flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4',
        className,
      )}
      {...props}
    />
  )
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        'font-serif text-xl leading-tight font-semibold tracking-tight text-foreground',
        className,
      )}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
}
