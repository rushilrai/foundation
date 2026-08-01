import { useSmoothText, type UIMessage } from '@convex-dev/agent/react'
import { stripCitationMarkers } from '@shared/stripCitations'
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
import { useSendProfileMessage } from '@/modules/profile/mutations'
import { useProfileThreadMessages } from '@/modules/profile/queries'
import type { Profile } from '@/modules/profile/schema'

type ProfileChatProps = {
  profile: Profile
}

// A run older than this is considered crashed and no longer blocks new runs.
const AGENT_RUN_STALE_MS = 10 * 60 * 1000

const sendErrorMessages: Record<string, string> = {
  RATE_LIMITED: 'Rate limit reached. Try again in a little while.',
  EMPTY_MESSAGE: 'Type a message first.',
  AGENT_BUSY: 'The agent is still working — wait for it to finish.',
}

// Mirrors FIRST_RUN_PROMPT in convex/modules/profile/nodeActions.ts.
const FIRST_RUN_PROMPT = 'Kick off my profile.'

export const ProfileChat = ({ profile }: ProfileChatProps) => {
  const messages = useProfileThreadMessages(profile.threadId)
  const sendMessage = useSendProfileMessage()

  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)

  const results = (messages.results ?? []).filter(
    (message) =>
      !(message.role === 'user' && message.text === FIRST_RUN_PROMPT),
  )
  const lastMessage = results[results.length - 1]
  const isBusy =
    profile.agentRunningSince !== undefined &&
    Date.now() - profile.agentRunningSince < AGENT_RUN_STALE_MS

  const handleSend = async () => {
    const prompt = draft.trim()
    if (!prompt || isBusy) {
      return
    }

    setSendError(null)
    setDraft('')

    try {
      const result = await sendMessage({
        profileId: profile._id,
        threadId: profile.threadId,
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
              {results.length === 0 && !isBusy && (
                <p className="text-sm text-muted-foreground">
                  No messages yet.
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
            placeholder="Tell the agent about yourself — e.g. “add my new trading bot project”"
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

          if (
            part.type.startsWith('tool-') ||
            part.type.includes('web_search')
          ) {
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
  const [visibleText] = useSmoothText(stripCitationMarkers(text), {
    startStreaming: streaming,
  })

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
  issues?: Array<string>
  error?: string
}

const getToolOutput = (part: UIMessage['parts'][number]): ToolOutput | null => {
  if ('output' in part && part.output && typeof part.output === 'object') {
    return part.output as ToolOutput
  }
  return null
}

const ToolMarker = ({ part }: { part: UIMessage['parts'][number] }) => {
  const isUpdate = part.type === 'tool-updateProfile'
  const isListDocuments = part.type === 'tool-listDocuments'
  const isReadDocument = part.type === 'tool-readDocument'
  const output = getToolOutput(part)

  const hasErrored =
    ('state' in part && part.state === 'output-error') ||
    output?.error !== undefined
  const hasFinished =
    output !== null || ('state' in part && part.state === 'output-available')
  const isWorking =
    !hasFinished && !hasErrored && !isListDocuments && !isReadDocument

  let label: string
  if (hasErrored) {
    if (isUpdate) {
      label = 'Profile update failed'
    } else if (isReadDocument) {
      label = "Couldn't read document"
    } else {
      label = 'Tool call failed'
    }
  } else if (isUpdate) {
    if (!output) {
      label = 'Updating profile...'
    } else if (output.ok) {
      label = 'Profile updated'
    } else {
      label = 'Fixing profile issues'
    }
  } else if (isListDocuments) {
    label = 'Checked documents'
  } else if (isReadDocument) {
    label = 'Read a document'
  } else {
    // Everything else is provider-executed web search.
    label = hasFinished ? 'Web search' : 'Searching the web...'
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
