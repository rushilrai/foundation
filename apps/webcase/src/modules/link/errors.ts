import type { FunctionReference, FunctionReturnType } from 'convex/server'

// Turning the `{ error: 'CODE' }` results of the link functions into copy.

/** The error codes a Convex function returns, from its return type. */
export type ErrorCode<
  F extends FunctionReference<'query' | 'mutation' | 'action'>,
> = Extract<FunctionReturnType<F>, { error: string }>['error']

/**
 * A message for every error code a function returns. Keyed by the code
 * union, so a code added on the server is a type error until it has copy.
 */
export type ErrorMessages<
  F extends FunctionReference<'query' | 'mutation' | 'action'>,
> = Record<ErrorCode<F>, string>

/** The wording used wherever these come up, so each reads the same everywhere. */
export const MESSAGES = {
  UNAUTHORIZED: 'You’ve been signed out. Sign in again.',
  INVALID_URL: 'That doesn’t look like a link.',
  NOT_FOUND: 'This link is no longer in your library.',
  NETWORK: 'Couldn’t reach Webcase. Check your connection.',
  GENERIC: 'Something went wrong. Try again.',
} as const

/**
 * The message for `code`, or a generic one for a code this build does not
 * know yet (a newer server).
 */
export const messageFor = <C extends string>(
  messages: Record<C, string>,
  code: C,
): string =>
  (messages as Partial<Record<string, string>>)[code] ?? MESSAGES.GENERIC
