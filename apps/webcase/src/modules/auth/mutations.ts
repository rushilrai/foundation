import { useMutation } from '@tanstack/react-query'

import { performLogout } from './logout'
import type { SignInInput, SignUpInput } from './schema'
import { signInWithEmail, signUpWithEmail } from './service'
import { resolveRedirect } from './utils'

// A full page load after signing in, so the next page renders on the server
// with the new session cookie and the Convex client starts authenticated.
function continueTo(redirect: string | undefined) {
  window.location.assign(resolveRedirect(redirect))
}

export function useSignInMutation(redirect: string | undefined) {
  return useMutation({
    mutationFn: (input: SignInInput) => signInWithEmail(input),
    onSuccess: () => continueTo(redirect),
  })
}

export function useSignUpMutation(redirect: string | undefined) {
  return useMutation({
    mutationFn: (input: SignUpInput) => signUpWithEmail(input),
    onSuccess: () => continueTo(redirect),
  })
}

export function useSignOutMutation() {
  return useMutation({ mutationFn: performLogout })
}
