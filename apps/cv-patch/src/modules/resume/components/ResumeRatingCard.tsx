import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { useRequestResumeRating } from '@/modules/resume/mutations'
import type { Resume } from '@/modules/resume/schema'

type ResumeRatingCardProps = {
  resume: Resume
}

const scoreColor = (score: number, max: number) => {
  const ratio = score / max
  if (ratio >= 0.8) return 'text-green-600 dark:text-green-400'
  if (ratio >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-destructive'
}

export const ResumeRatingCard = ({ resume }: ResumeRatingCardProps) => {
  const requestRating = useRequestResumeRating()
  const [requested, setRequested] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  if (resume.status !== 'ready') {
    return null
  }

  if (!resume.rating) {
    const handleRequest = async () => {
      setRequestError(null)
      setRequested(true)
      try {
        const result = await requestRating({ resumeId: resume._id })
        if ('error' in result) {
          setRequested(false)
          setRequestError(
            result.error === 'RATE_LIMITED'
              ? 'Rate limit reached. Try again in a little while.'
              : 'Failed to start the rating. Please try again.',
          )
        }
      } catch (error) {
        console.error('Failed to request rating', error)
        setRequested(false)
        setRequestError('Failed to start the rating. Please try again.')
      }
    }

    return (
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Rating</h3>
        {requested ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Rating in progress...
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-muted-foreground">
              Get a rubric-based score with concrete suggestions.
            </p>
            {requestError && (
              <p className="text-sm text-destructive">{requestError}</p>
            )}
            <Button variant="outline" size="sm" onClick={handleRequest}>
              Rate resume
            </Button>
          </div>
        )}
      </div>
    )
  }

  const { rating } = resume

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
