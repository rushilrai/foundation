import { useSmoothText, type UIMessage } from '@convex-dev/agent/react'
import { IconCheck, IconLoader2 } from '@tabler/icons-react'
import { useState } from 'react'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Button } from '@/components/ui/button'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Message, MessageContent } from '@/components/ui/message'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller'
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

// Mirrors FIRST_RUN_PROMPT in convex/modules/patch/nodeActions.ts.
const FIRST_RUN_PROMPT =
  'Analyze the job description, tailor my resume to it, and write a cover letter.'

export const PatchChat = ({ patch }: PatchChatProps) => {
  const messages = usePatchThreadMessages(patch.threadId)
  const sendMessage = useSendPatchMessage()

  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)

  const results = (messages.results ?? []).filter(
    (message) =>
      !(message.role === 'user' && message.text === FIRST_RUN_PROMPT),
  )
  const lastMessage = results[results.length - 1]
  const isBusy = patch.agentRunningSince !== undefined

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
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport className="p-6">
            <MessageScrollerContent className="gap-4">
              {!patch.threadId && (
                <p className="text-sm text-muted-foreground">
                  This variant was generated before chat existed. Send a message
                  to start a conversation about it.
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
                <MessageScrollerItem
                  key={message.key}
                  messageId={message.key}
                  scrollAnchor={message.role === 'user'}
                >
                  <ChatMessage message={message} />
                </MessageScrollerItem>
              ))}

              {showThinking && (
                <MessageScrollerItem messageId="thinking">
                  <Marker>
                    <MarkerIcon>
                      <IconLoader2 className="animate-spin" />
                    </MarkerIcon>
                    <MarkerContent>Working...</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>

          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="border-t p-4">
        {sendError && (
          <p className="mb-2 text-sm text-destructive">{sendError}</p>
        )}

        <div className="flex items-stretch gap-2">
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

          <Button
            onClick={handleSend}
            disabled={!draft.trim() || isBusy}
            className="h-auto"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

const ChatMessage = ({ message }: { message: UIMessage }) => {
  if (message.role === 'user') {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end">
            <BubbleContent className="whitespace-pre-wrap">
              {message.text}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  return (
    <Message>
      <MessageContent>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <AssistantText
                key={`part-${index}`}
                text={part.text}
                streaming={message.status === 'streaming'}
              />
            )
          }

          if (part.type.startsWith('tool-')) {
            return <ToolMarker key={`part-${index}`} part={part} />
          }

          return null
        })}
      </MessageContent>
    </Message>
  )
}

const AssistantText = ({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) => {
  const [visibleText] = useSmoothText(text, { startStreaming: streaming })

  if (!visibleText) {
    return null
  }

  return (
    <Bubble variant="ghost">
      <BubbleContent className="whitespace-pre-wrap">
        {visibleText}
      </BubbleContent>
    </Bubble>
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

const ToolMarker = ({ part }: { part: UIMessage['parts'][number] }) => {
  const isUpdate = part.type === 'tool-updateResume'
  const isCoverLetter = part.type === 'tool-writeCoverLetter'
  const output = getToolOutput(part)

  const hasErrored = 'state' in part && part.state === 'output-error'
  const isWorking = (isUpdate || isCoverLetter) && !output && !hasErrored

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
    <Marker>
      <MarkerIcon>
        {isWorking ? (
          <IconLoader2 className="animate-spin" />
        ) : (
          <IconCheck className={hasErrored ? 'text-destructive' : undefined} />
        )}
      </MarkerIcon>
      <MarkerContent className={hasErrored ? 'text-destructive' : undefined}>
        {label}
      </MarkerContent>
    </Marker>
  )
}
