import { auth } from '@clerk/tanstack-react-start/server'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export const authGuard = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()

  if (!userId) {
    throw redirect({ to: '/sign-in/$' })
  }

  return { userId }
})

export const getAuthToken = createServerFn({ method: 'GET' }).handler(
  async () => {
    const authObject = await auth()

    if (!authObject.userId) {
      return { token: null, userId: null }
    }

    const token = await authObject.getToken({ template: 'convex' })

    return { token, userId: authObject.userId }
  },
)
