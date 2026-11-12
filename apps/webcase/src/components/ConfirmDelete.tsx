import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'

import { InlineError } from '@/components/EmptyState'
import { cn } from '@/components/lib/utils'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

const DEFAULT_ERROR = 'Couldn’t delete the link. Try again.'

// Convex handlers resolve with `{ error }` instead of throwing, so only an
// explicit success counts: `true` or `{ success: true }`.
const isSuccess = (result: unknown): boolean =>
  result === true ||
  (typeof result === 'object' &&
    result !== null &&
    'success' in result &&
    result.success === true)

type ConfirmDeleteProps = {
  /**
   * Runs on confirm. Uncontrolled, the dialog closes only when this returns
   * or resolves to `true` or `{ success: true }` (e.g. the `remove`
   * mutation's result); anything else, or a throw, keeps it open with an
   * error. Controlled, it never closes itself.
   */
  onConfirm: () => unknown
  /** Controlled open state. Pass with `onOpenChange`; the parent closes it on success. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Controlled busy state; otherwise busy while `onConfirm`'s promise is pending. */
  pending?: boolean
  /** Shown in the dialog. Uncontrolled, a failed confirm shows a default message. */
  error?: React.ReactNode
  label?: string
  title?: string
  description?: string
  confirmLabel?: string
  className?: string
}

/**
 * A destructive action row ("Delete link") that asks before it acts.
 * Fits at the bottom of the link detail sheet.
 */
export const ConfirmDelete = ({
  onConfirm,
  open: openProp,
  onOpenChange,
  pending: pendingProp,
  error,
  label = 'Delete link',
  title = 'Delete this link?',
  description = 'It leaves your library for good, along with its tags.',
  confirmLabel = 'Delete',
  className,
}: ConfirmDeleteProps) => {
  const controlled = openProp !== undefined
  const [openState, setOpenState] = useState(false)
  const [running, setRunning] = useState(false)
  const [failed, setFailed] = useState(false)

  const open = controlled ? openProp : openState
  const pending = pendingProp ?? running

  const setOpen = (next: boolean) => {
    if (next) setFailed(false)
    if (!controlled) setOpenState(next)
    onOpenChange?.(next)
  }

  const confirm = async () => {
    setRunning(true)
    setFailed(false)
    try {
      const result = await onConfirm()
      if (controlled) return
      if (isSuccess(result)) setOpenState(false)
      else setFailed(true)
    } catch {
      setFailed(true)
    } finally {
      setRunning(false)
    }
  }

  const shownError = error ?? (failed && !controlled ? DEFAULT_ERROR : null)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next)
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            className={cn(
              'h-11 w-full justify-start gap-2 rounded-lg px-3 text-sm text-destructive hover:bg-destructive/5 hover:text-destructive aria-expanded:bg-destructive/5 aria-expanded:text-destructive',
              className,
            )}
          />
        }
      >
        <IconTrash className="size-4.5" aria-hidden />
        {label}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <InlineError>{shownError}</InlineError>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30"
            disabled={pending}
            onClick={confirm}
          >
            {pending ? 'Deleting…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
