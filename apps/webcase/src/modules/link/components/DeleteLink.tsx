import type { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { useState } from 'react'

import { ConfirmDelete } from '@/components/ConfirmDelete'
import { messageFor, MESSAGES, type ErrorMessages } from '../errors'
import { useRemoveLink } from '../mutations'

const DELETE_ERRORS: ErrorMessages<typeof api.modules.link.mutations.remove> = {
  UNAUTHORIZED: MESSAGES.UNAUTHORIZED,
  // Never shown: an already deleted link is what was asked for.
  NOT_FOUND: MESSAGES.NOT_FOUND,
}

/** Delete, behind a confirmation. */
export const DeleteLink = ({
  link,
  onDeleted,
}: {
  link: Doc<'links'>
  onDeleted: () => void
}) => {
  const removeLink = useRemoveLink()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <ConfirmDelete
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
      pending={pending}
      error={error}
      onConfirm={async () => {
        setPending(true)
        setError(null)
        try {
          const result = await removeLink({ linkId: link._id })
          if ('error' in result && result.error !== 'NOT_FOUND') {
            setError(messageFor(DELETE_ERRORS, result.error))
            return
          }
          setOpen(false)
          onDeleted()
        } catch (caught) {
          console.error('Error deleting the link', caught)
          setError('Couldn’t delete the link. Try again.')
        } finally {
          setPending(false)
        }
      }}
    />
  )
}
