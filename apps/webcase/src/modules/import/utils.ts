import { IMPORT_SPACING_MS } from '@shared/limits'

/**
 * When imported links will have their titles, previews and summaries,
 * from the server's pace: "over the next 7 minutes or so".
 */
export const enrichEstimate = (count: number) => {
  const minutes = Math.ceil((count * IMPORT_SPACING_MS) / 60_000)
  return minutes <= 1
    ? 'over the next minute'
    : `over the next ${minutes} minutes or so`
}
