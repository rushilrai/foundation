import { HOUR, RateLimiter } from '@convex-dev/rate-limiter'

import { components } from '../_generated/api'

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  createPatch: {
    kind: 'token bucket',
    rate: 20,
    period: 24 * HOUR,
    capacity: 5,
  },
  sendAgentMessage: {
    kind: 'token bucket',
    rate: 30,
    period: HOUR,
    capacity: 10,
  },
  rateResume: { kind: 'token bucket', rate: 6, period: HOUR, capacity: 3 },
})
