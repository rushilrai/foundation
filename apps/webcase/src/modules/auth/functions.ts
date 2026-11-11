import { createServerFn } from '@tanstack/react-start'

import { getToken } from './server'

// The Convex token for the request's session cookie, or null when signed out.
export const getAuthToken = createServerFn({ method: 'GET' }).handler(
  async () => (await getToken()) ?? null,
)
