import { z } from 'zod'

import { searchText } from '@/lib/searchParams'

export const MIN_PASSWORD_LENGTH = 8

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .pipe(z.email('Enter a valid email'))

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: emailSchema,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`),
})

export type SignInInput = z.infer<typeof signInSchema>
export type SignUpInput = z.infer<typeof signUpSchema>

// `redirect` is checked by resolveRedirect wherever it is used, so any
// value is accepted here rather than failing the page.
export const authSearchSchema = z.object({
  redirect: searchText,
})

export type AuthSearch = z.infer<typeof authSearchSchema>
