import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'

import { components } from '../_generated/api'
import { DAILY_IMPORT_LIMIT } from '../../shared/limits'

// Sign-up is open and accounts are free, so per-user buckets alone don't
// bound spend: every bucket that costs money or fetches pages has a global
// (unkeyed) twin. The ceilings are generous for a handful of real users.

// Summaries (model calls) across all users, per day. The owner's whole
// Pocket export is ~250 links; one account can import DAILY_IMPORT_LIMIT
// a day, so no single account empties it.
const GLOBAL_SUMMARIES_PER_DAY = 3000
// Library questions across all users, per day. Each sends a whole library.
const GLOBAL_ASKS_PER_DAY = 500
// Save-page previews (a page fetch and a tag-suggestion call) across all
// users, per hour.
const GLOBAL_PREVIEWS_PER_HOUR = 1000

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per user (keyed by the Better Auth user id) ------------------------------

  // One page fetch and one decision call each. Generous enough to paste a
  // run of links in one sitting.
  preview: {
    kind: 'token bucket',
    rate: 120,
    period: HOUR,
    capacity: 40,
  },
  // Each question sends the whole library to the model.
  ask: {
    kind: 'token bucket',
    rate: 60,
    period: 24 * HOUR,
    capacity: 15,
  },
  // Counted per imported link, not per call: each schedules a page fetch
  // and a summary. A larger export imports over several days.
  importLinks: {
    kind: 'token bucket',
    rate: DAILY_IMPORT_LIMIT,
    period: 24 * HOUR,
    capacity: DAILY_IMPORT_LIMIT,
  },
  // Each saved link, and each summary retry, schedules a summary.
  createLink: {
    kind: 'token bucket',
    rate: 300,
    period: HOUR,
    capacity: 100,
  },

  // Global (no key) ----------------------------------------------------------

  // Taken by enrich before the model call. When empty, the page's metadata
  // still fills in and the summary is queued again for later (see
  // nodeActions.deferSummary).
  summaryGlobal: {
    kind: 'token bucket',
    rate: GLOBAL_SUMMARIES_PER_DAY,
    period: 24 * HOUR,
    capacity: GLOBAL_SUMMARIES_PER_DAY,
  },
  askGlobal: {
    kind: 'token bucket',
    rate: GLOBAL_ASKS_PER_DAY,
    period: 24 * HOUR,
    capacity: GLOBAL_ASKS_PER_DAY,
  },
  previewGlobal: {
    kind: 'token bucket',
    rate: GLOBAL_PREVIEWS_PER_HOUR,
    period: HOUR,
    capacity: GLOBAL_PREVIEWS_PER_HOUR,
  },
})
