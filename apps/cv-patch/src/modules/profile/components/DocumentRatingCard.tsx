import type { ProfileDocument } from '@/modules/profile/schema'

type DocumentRatingCardProps = {
  rating: NonNullable<ProfileDocument['rating']>
}

const scoreColor = (score: number, max: number) => {
  const ratio = score / max
  if (ratio >= 0.8) return 'text-green-600 dark:text-green-400'
  if (ratio >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-destructive'
}

export const DocumentRatingCard = ({ rating }: DocumentRatingCardProps) => {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Rating</h3>
        <p className={`text-lg font-bold ${scoreColor(rating.overall, 100)}`}>
          {rating.overall}/100
        </p>
      </div>

      <div className="space-y-2">
        {rating.categories.map((category) => (
          <div key={category.name}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{category.name}</p>
              <p className={`text-xs ${scoreColor(category.score, 10)}`}>
                {category.score}/10
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{category.comments}</p>
          </div>
        ))}
      </div>

      {rating.suggestions.length > 0 && (
        <div>
          <p className="text-xs font-medium">Suggestions</p>
          <ul className="mt-1 space-y-1">
            {rating.suggestions.map((suggestion, index) => (
              <li key={index} className="text-xs text-muted-foreground">
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
