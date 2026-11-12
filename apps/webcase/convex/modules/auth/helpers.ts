import type { Auth } from 'convex/server'

// The signed-in user's Better Auth id, the token subject, or null when signed
// out. Works with query, mutation and action contexts. Callers return
// { error: 'UNAUTHORIZED' } on null rather than throwing.
export const getUserId = async (ctx: {
  auth: Auth
}): Promise<string | null> => {
  const identity = await ctx.auth.getUserIdentity()

  return identity?.subject ?? null
}
