import { useSmoothText, type UIMessage } from '@convex-dev/agent/react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/components/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useSendPatchMessage } from '@/modules/patch/mutations'
import { usePatchThreadMessages } from '@/modules/patch/queries'
import type { Patch } from '@/modules/patch/schema'

type PatchChatProps = {
  patch: Patch
}

const sendErrorMessages: Record<string, string> = {
  RATE_LIMITED: 'Rate limit reached. Try again in a little while.',
  EMPTY_MESSAGE: 'Type a message first.',
  AGENT_BUSY: 'The agent is still working — wait for it to finish.',
}

// Mirrors FIRST_RUN_PROMPT in convex/modules/patch/nodeActions.ts — the
// synthetic message that kicks off a new thread, hidden from the chat.
const FIRST_RUN_PROMPT =
  'Analyze the job description, tailor my resume to it, and write a cover letter.'

export const PatchChat = ({ patch }: PatchChatProps) => {
  const messages = usePatchThreadMessages(patch.threadId)
  const sendMessage = useSendPatchMessage()

  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const results = (messages.results ?? []).filter(
    (message) =>
      !(message.role === 'user' && message.text === FIRST_RUN_PROMPT),
  )
  const lastMessage = results[results.length - 1]
  const isBusy = patch.agentRunningSince !== undefined

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [results.length, lastMessage?.text])

  const handleSend = async () => {
    const prompt = draft.trim()
    if (!prompt || isBusy) {
      return
    }

    setSendError(null)
    setDraft('')

    try {
      const result = await sendMessage({
        patchId: patch._id,
        threadId: patch.threadId,
        prompt,
      })

      if ('error' in result) {
        setSendError(sendErrorMessages[result.error] ?? 'Failed to send.')
        setDraft(prompt)
      }
    } catch (error) {
      console.error('Failed to send message', error)
      setSendError('Failed to send.')
      setDraft(prompt)
    }
  }

  const showThinking =
    isBusy && (!lastMessage || lastMessage.status !== 'streaming')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        {!patch.threadId && (
          <p className="text-sm text-muted-foreground">
            This variant was generated before chat existed. Send a message to
            start a conversation about it.
          </p>
        )}

        {patch.threadId && results.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {patch.status === 'generating'
              ? 'The agent is reading the job description...'
              : 'No messages yet.'}
          </p>
        )}

        {results.map((message) => (
          <ChatMessage key={message.key} message={message} />
        ))}

        {showThinking && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Working...</p>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        {sendError && (
          <p className="mb-2 text-sm text-destructive">{sendError}</p>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Ask for tweaks — e.g. “make the first Acme bullet lead with Kafka”"
            className="min-h-10 flex-1 resize-none"
            rows={2}
          />

          <Button onClick={handleSend} disabled={!draft.trim() || isBusy}>
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

const ChatMessage = ({ message }: { message: UIMessage }) => {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === 'streaming',
  })

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
          {message.text}
        </div>
      </div>
    )
  }

  const toolParts = message.parts.filter((part) =>
    part.type.startsWith('tool-'),
  )

  return (
    <div className="flex flex-col items-start gap-2">
      {toolParts.map((part, index) => (
        <ToolChip key={`tool-${index}`} part={part} />
      ))}

      {visibleText && (
        <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap">
          {visibleText}
        </div>
      )}
    </div>
  )
}

type ToolOutput = {
  ok?: boolean
  versionNumber?: number
  issues?: Array<string>
}

const getToolOutput = (part: UIMessage['parts'][number]): ToolOutput | null => {
  if ('output' in part && part.output && typeof part.output === 'object') {
    return part.output as ToolOutput
  }
  return null
}

const ToolChip = ({ part }: { part: UIMessage['parts'][number] }) => {
  const isUpdate = part.type === 'tool-updateResume'
  const isCoverLetter = part.type === 'tool-writeCoverLetter'
  const output = getToolOutput(part)

  const hasErrored = 'state' in part && part.state === 'output-error'

  let label: string
  if (hasErrored) {
    label = isUpdate
      ? 'Resume update failed'
      : isCoverLetter
        ? 'Cover letter failed'
        : 'Tool call failed'
  } else if (isCoverLetter) {
    label = output ? 'Cover letter ready' : 'Writing cover letter...'
  } else if (!isUpdate) {
    label = 'Read base resume'
  } else if (!output) {
    label = 'Updating resume...'
  } else if (output.ok) {
    label = `Saved resume version ${output.versionNumber}`
  } else {
    label = 'Validation caught issues — revising'
  }

  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground',
        (isUpdate || isCoverLetter) &&
          output?.ok &&
          'border-primary/40 text-foreground',
      )}
    >
      {label}
    </span>
  )
}
