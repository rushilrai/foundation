import { IconSparkles } from '@tabler/icons-react'

type AskPromptProps = {
  question: string
  onAsk: () => void
}

/** Shown under the filter while the box holds a question: tap to ask it. */
export const AskPrompt = ({ question, onAsk }: AskPromptProps) => {
  return (
    <button
      type="button"
      onClick={onAsk}
      className="mt-3 flex h-11 w-full min-w-0 items-center gap-2 rounded-xl bg-primary/5 px-4 text-left text-sm outline-hidden transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-solid active:bg-primary/10"
    >
      <IconSparkles className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="shrink-0 font-medium text-primary">Ask</span>
      <span className="min-w-0 truncate text-muted-foreground">
        “{question.trim()}”
      </span>
      <kbd className="ml-auto hidden shrink-0 pl-2 font-mono text-2xs text-faint-foreground sm:inline">
        Enter
      </kbd>
    </button>
  )
}
