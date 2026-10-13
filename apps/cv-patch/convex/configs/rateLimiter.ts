import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'

import { components } from '../_generated/api'

// Each patch costs up to 4 LLM calls and a CloudConvert job.
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  createPatch: {
    kind: 'token bucket',
    rate: 20,
    period: 24 * HOUR,
    capacity: 5,
  },
})
