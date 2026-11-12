import { query } from '../../_generated/server'
import { authComponent } from '../../auth'

export const currentUser = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    { user: { name: string; email: string } } | { error: 'UNAUTHORIZED' }
  > => {
    const user = await authComponent.safeGetAuthUser(ctx)

    if (!user) {
      return { error: 'UNAUTHORIZED' }
    }

    return { user: { name: user.name, email: user.email } }
  },
})
