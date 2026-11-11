import { IconSparkles, IconX } from '@tabler/icons-react'

import { cn } from '@/components/lib/utils'

type AnswerCardProps = {
  /** The short answer. Ignored while `loading` or when `error` is set. */
  answer?: React.ReactNode
  loading?: boolean
  /** Why there is no answer, e.g. the ask was rate limited. Shown instead of the answer. */
  error?: React.ReactNode
  /** Shown small above the answer, e.g. the question that was asked. */
  question?: string
  /** Below the answer: e.g. the links it was drawn from. */
  children?: React.ReactNode
  onDismiss?: () => void
  className?: string
}

/** The result of asking the library a question: a quietly tinted cobalt block. */
export const AnswerCard = ({
  answer,
  loading = false,
  error,
  question,
  children,
  onDismiss,
  className,
}: AnswerCardProps) => {
  return (
    <section
      aria-label="Answer"
      className={cn(
        'relative rounded-xl bg-primary/[0.06] px-4 py-3.5',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 pr-8 text-primary">
        <IconSparkles className="size-3.5 shrink-0" aria-hidden />
        <h2 className="font-mono text-[0.6875rem] tracking-wide">
          {loading ? 'Thinking…' : error ? 'No answer' : 'Answer'}
        </h2>
        {question && (
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            <span aria-hidden>· </span>
            {question}
          </p>
        )}
      </div>

      {/* Only the answer (or error) is announced, not the chrome around it. */}
      <div aria-live="polite" aria-busy={loading || undefined}>
        {loading ? (
          <div className="mt-3 flex flex-col gap-2 pb-1">
            <span className="sr-only">Finding an answer…</span>
            <div className="h-3 w-full animate-pulse rounded-full bg-primary/10 motion-reduce:animate-none" />
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-primary/10 motion-reduce:animate-none" />
          </div>
        ) : error ? (
          <p className="mt-1.5 text-sm text-pretty text-destructive">{error}</p>
        ) : (
          <div className="mt-1.5 font-serif text-[1.0625rem] leading-snug text-pretty wrap-anywhere text-foreground">
            {answer}
          </div>
        )}
      </div>

      {!loading && !error && children && <div className="mt-3">{children}</div>}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-hidden transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid"
        >
          <IconX className="size-4" aria-hidden />
          <span className="sr-only">Dismiss answer</span>
        </button>
      )}
    </section>
  )
}
