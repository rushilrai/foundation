import type { api } from '@convex/_generated/api'
import type { Doc } from '@convex/_generated/dataModel'
import { IconCheck } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

import { TagPicker, type TagPickerActions } from '@/components/TagPicker'
import { messageFor, MESSAGES, type ErrorMessages } from '../errors'
import { useUpdateLinkTags } from '../mutations'

type TagSave =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'failed'; message: string }

const TAG_ERRORS: ErrorMessages<typeof api.modules.link.mutations.updateTags> =
  {
    UNAUTHORIZED: MESSAGES.UNAUTHORIZED,
    NOT_FOUND: MESSAGES.NOT_FOUND,
  }

const sameTags = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((tag, index) => tag === b[index])

type LinkTagEditorProps = {
  link: Doc<'links'>
  allTags: readonly string[]
  /** Lets the sheet add a tag still being typed when it closes. */
  actionsRef?: React.Ref<TagPickerActions>
}

/** The link's tags, saved on every change; the latest change wins. */
export const LinkTagEditor = ({
  link,
  allTags,
  actionsRef,
}: LinkTagEditorProps) => {
  const updateTags = useUpdateLinkTags()
  // The user's edit until the server has it; null shows the live tags.
  const [draft, setDraft] = useState<string[] | null>(null)
  const [save, setSave] = useState<TagSave>({ status: 'idle' })
  const requestRef = useRef(0)

  const tags = draft ?? link.tags

  const send = async (next: string[]) => {
    const request = ++requestRef.current
    setSave({ status: 'saving' })
    try {
      const result = await updateTags({ linkId: link._id, tags: next })
      if (request !== requestRef.current) return
      if ('error' in result) {
        setSave({
          status: 'failed',
          message: messageFor(TAG_ERRORS, result.error),
        })
      } else {
        // The live query already carries the new tags.
        setDraft(null)
        setSave({ status: 'saved' })
      }
    } catch (error) {
      if (request !== requestRef.current) return
      console.error('Error saving tags', error)
      setSave({
        status: 'failed',
        message: 'Couldn’t save the tags. Check your connection.',
      })
    }
  }

  // "Saved" fades after a moment.
  useEffect(() => {
    if (save.status !== 'saved') return
    const timer = setTimeout(() => setSave({ status: 'idle' }), 2000)
    return () => clearTimeout(timer)
  }, [save.status])

  return (
    <div className="flex flex-col gap-1.5">
      <TagPicker
        value={tags}
        allTags={allTags}
        actionsRef={actionsRef}
        onChange={(next) => {
          if (sameTags(next, tags)) return
          setDraft(next)
          void send(next)
        }}
        error={
          save.status === 'failed' && (
            <>
              {save.message}{' '}
              {draft && (
                <button
                  type="button"
                  onClick={() => void send(draft)}
                  className="rounded-sm font-medium underline underline-offset-2 outline-hidden focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
                >
                  Try again
                </button>
              )}
            </>
          )
        }
      />
      <p
        aria-live="polite"
        className="flex h-4 items-center gap-1 font-mono text-2xs text-faint-foreground"
      >
        {save.status === 'saving' && 'Saving…'}
        {save.status === 'saved' && (
          <>
            <IconCheck className="size-3" aria-hidden />
            Saved
          </>
        )}
      </p>
    </div>
  )
}
