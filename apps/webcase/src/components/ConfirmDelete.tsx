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

type ConfirmDeleteProps = {
  /** Runs on confirm. If it returns a promise, the dialog stays open until it settles. */
  onConfirm: () => unknown
  /** Shown in the dialog, e.g. when the delete failed. */
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
  error,
  label = 'Delete link',
  title = 'Delete this link?',
  description = 'It leaves your library for good, along with its tags.',
  confirmLabel = 'Delete',
  className,
}: ConfirmDeleteProps) => {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const confirm = async () => {
    setPending(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // The caller shows what went wrong through `error`; keep the dialog open.
    } finally {
      setPending(false)
    }
  }

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
        <InlineError>{error}</InlineError>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            className="h-11 bg-destructive text-primary-foreground hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30"
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
