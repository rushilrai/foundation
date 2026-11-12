import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'

type NoResultsProps = {
  query: string
  tag: string | null
  onClear: () => void
}

/** Nothing matches the search, the tag, or both: say which, offer a way out. */
export const NoResults = ({ query, tag, onClear }: NoResultsProps) => {
  const title =
    query && tag
      ? `Nothing tagged ${tag} matches “${query}”.`
      : tag
        ? `Nothing tagged ${tag}.`
        : `Nothing matches “${query}”.`

  return (
    <EmptyState
      className="py-16"
      title={<span className="wrap-anywhere">{title}</span>}
      action={
        <Button variant="outline" className="h-11 px-5" onClick={onClear}>
          {query && tag
            ? 'Clear search and tag'
            : tag
              ? 'Show all links'
              : 'Clear search'}
        </Button>
      }
    />
  )
}
