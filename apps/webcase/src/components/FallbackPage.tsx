import { Wordmark } from '@/components/Wordmark'

type FallbackPageProps = {
  /** One serif line saying what happened. */
  title: React.ReactNode
  /** e.g. the link back to the library. */
  actions: React.ReactNode
  /** A line of detail under the actions, e.g. the error during development. */
  footnote?: React.ReactNode
}

/** A whole page for when there is nothing else to show: not found, or broken. */
export const FallbackPage = ({
  title,
  actions,
  footnote,
}: FallbackPageProps) => {
  return (
    <main className="page-column flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col justify-center py-12">
        <Wordmark className="text-3xl" />
        <h1 className="mt-10 font-serif text-2xl font-medium text-pretty">
          {title}
        </h1>
        <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
        {footnote}
      </div>
    </main>
  )
}
