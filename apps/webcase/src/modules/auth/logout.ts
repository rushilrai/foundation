import { signOut } from './service'

// A full reload drops the Convex client's auth and every cached query, as the
// Convex Better Auth guide recommends; Home then redirects to sign-in.
export async function performLogout() {
  await signOut()
  window.location.reload()
}
