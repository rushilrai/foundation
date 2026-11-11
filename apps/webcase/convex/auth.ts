import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth/minimal'

import { components } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import authConfig from './auth.config'

// Users, sessions and accounts live in the Better Auth component's own tables.
// There is no app-level users table: app rows are keyed by the Better Auth
// user id, the token subject (see modules/auth/helpers.ts).
export const authComponent = createClient<DataModel>(components.betterAuth)

// Extra origins allowed to call auth, comma separated: a second local dev
// port, or a preview URL. Unset in production, where SITE_URL is the only one.
const trustedOrigins = () =>
  (process.env.AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    // The app's own origin: the browser reaches auth through its /api/auth proxy.
    baseURL: process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: trustedOrigins(),
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
  })
