import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'

import { components } from '../_generated/api'

// All keyed by the Better Auth user id.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
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
  // Counted per link, not per call: each new link schedules a page fetch
  // and a summary. Capacity covers a one-off import of a few thousand.
  importLinks: {
    kind: 'token bucket',
    rate: 5000,
    period: 24 * HOUR,
    capacity: 5000,
  },
  // Each saved link schedules a summary.
  createLink: {
    kind: 'token bucket',
    rate: 300,
    period: HOUR,
    capacity: 100,
  },
})
