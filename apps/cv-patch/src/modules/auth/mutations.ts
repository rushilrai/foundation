import { api } from '@convex/_generated/api.js'
import { useConvexAuth, useMutation } from 'convex/react'
import { useEffect } from 'react'

// Upserts the user row on sign-in so the app works even when the Clerk
// webhook has not synced this user (e.g. local/dev deployments).
export function useEnsureUser() {
  const { isAuthenticated } = useConvexAuth()
  const ensureUser = useMutation(api.modules.user.mutations.ensureUser)

  useEffect(() => {
    if (isAuthenticated) {
      ensureUser({}).catch((error) => {
        console.error('Failed to ensure user', error)
      })
    }
  }, [isAuthenticated, ensureUser])
}
