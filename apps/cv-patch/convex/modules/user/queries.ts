import { query } from 'convex/_generated/server'

import { getByExternalId } from './helpers'
import type { Doc } from 'convex/_generated/dataModel'

export const currentUser = query({
  args: {},
  handler: async (ctx): Promise<{ user: Doc<'users'> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { error: 'UNAUTHORIZED' }

    const user = await getByExternalId(ctx, identity.subject)

    if (!user) {
      return {
        error: 'USER_NOT_FOUND',
      }
    }

    return { user }
  },
})
