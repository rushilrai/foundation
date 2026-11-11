import { z } from 'zod'

const NoTrailingSlashUrlSchema = z
  .url()
  .refine((value) => !value.endsWith('/'), 'must not end with a trailing slash')

const EnvSchema = z.object({
  VITE_CONVEX_URL: NoTrailingSlashUrlSchema,
  VITE_CONVEX_SITE_URL: NoTrailingSlashUrlSchema,
})

export type Env = z.infer<typeof EnvSchema>

function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw)

  if (result.success) return result.data

  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n')

  throw new Error(`Invalid webcase environment:\n${issues}`)
}

export const env = parseEnv({
  VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
  VITE_CONVEX_SITE_URL: import.meta.env.VITE_CONVEX_SITE_URL,
})
