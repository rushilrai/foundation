import { authClient } from './client'
import type { SignInInput, SignUpInput } from './schema'

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

const SIGN_IN_MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Wrong email or password.',
}

const SIGN_UP_MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: 'An account with this email already exists.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'An account with this email already exists.',
  PASSWORD_TOO_SHORT: 'Use a longer password.',
  INVALID_EMAIL: 'Enter a valid email.',
}

export async function signInWithEmail(input: SignInInput) {
  const response = await authClient.signIn.email({
    email: input.email.trim(),
    password: input.password,
  })

  if (response.error) {
    const code = response.error.code
    throw new AuthError(
      (code && SIGN_IN_MESSAGES[code]) ?? "Couldn't sign in. Try again.",
    )
  }
}

export async function signUpWithEmail(input: SignUpInput) {
  const response = await authClient.signUp.email({
    name: input.name.trim(),
    email: input.email.trim(),
    password: input.password,
  })

  if (response.error) {
    const code = response.error.code
    throw new AuthError(
      (code && SIGN_UP_MESSAGES[code]) ??
        "Couldn't create the account. Try again.",
    )
  }
}

export async function signOut() {
  const response = await authClient.signOut()

  if (response.error) {
    throw new AuthError(response.error.message ?? "Couldn't sign out.")
  }
}
