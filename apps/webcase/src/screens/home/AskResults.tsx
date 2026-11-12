import type { Doc, Id } from '@convex/_generated/dataModel'

import { AnswerCard } from '@/components/AnswerCard'
import type { DateContext } from '@/components/lib/dates'
import { MonthHeading } from '@/components/MonthHeading'
import { LinkItem } from '@/modules/link/components/LinkList'
import type { AskState } from '@/modules/link/mutations'

type AskResultsProps = {
  state: Exclude<AskState, { status: 'idle' }>
  byId: ReadonlyMap<Id<'links'>, Doc<'links'>>
  dates: DateContext
  onOpen: (link: Doc<'links'>) => void
  onTagSelect: (tag: string) => void
  onDismiss: () => void
}

/**
 * The answer, then the links it drew on, in the order the answer gave them.
 * An answer always covers the whole library, never one tag.
 */
export const AskResults = ({
  state,
  byId,
  dates,
  onOpen,
  onTagSelect,
  onDismiss,
}: AskResultsProps) => {
  // Links deleted since the answer drop out.
  const sources =
    state.status === 'answered'
      ? state.linkIds.flatMap((id) => byId.get(id) ?? [])
      : []

  return (
    <div className="mt-4">
      <AnswerCard
        question={state.question}
        loading={state.status === 'asking'}
        answer={state.status === 'answered' ? state.answer : undefined}
        error={state.status === 'failed' ? state.message : undefined}
        onDismiss={state.status === 'asking' ? undefined : onDismiss}
      />
      {sources.length > 0 && (
        <section aria-label="Links in the answer">
          <MonthHeading>
            {sources.length === 1
              ? 'From 1 link'
              : `From ${sources.length} links`}
          </MonthHeading>
          {sources.map((link) => (
            <LinkItem
              key={link._id}
              link={link}
              dates={dates}
              onOpen={onOpen}
              onTagSelect={onTagSelect}
            />
          ))}
        </section>
      )}
    </div>
  )
}
