import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth/minimal'

import { MIN_PASSWORD_LENGTH } from '../shared/limits'
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
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    // Kept in the component's rateLimit table: Better Auth's default store is
    // memory, which each Convex function run starts empty. Keyed by client IP
    // and path (see withClientIp in http.ts for which IP).
    rateLimit: {
      enabled: true,
      storage: 'database',
      customRules: {
        // Password guessing: a few tries, then a minute's wait.
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 10 * 60, max: 5 },
        // Session reads on every page load, many from the app server's own
        // address (the SSR token) rather than the browser's. They need a
        // valid session cookie, so there is nothing to guess.
        '/get-session': false,
        '/convex/*': false,
      },
    },
    plugins: [convex({ authConfig })],
  })
