import { v } from 'convex/values'

import type { Id } from '../../_generated/dataModel'
import { internalMutation, mutation } from '../../_generated/server'
import { getByExternalId } from './helpers'

// Upserts the signed-in user from their JWT claims. Called by the app on
// sign-in so user rows exist even if the Clerk webhook never fired (e.g.
// local/dev deployments the webhook cannot reach).
export const ensureUser = mutation({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ userId: Id<'users'> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    // Raw lookup (no deleted filter) so a soft-deleted user is revived
    // instead of duplicated.
    const existing = await ctx.db
      .query('users')
      .withIndex('by_externalId', (q) => q.eq('externalId', identity.subject))
      .unique()

    try {
      if (existing) {
        if (existing.deleted) {
          await ctx.db.patch(existing._id, {
            deleted: false,
            updatedAt: Date.now(),
          })
        }
        return { userId: existing._id }
      }

      const userId = await ctx.db.insert('users', {
        externalId: identity.subject,
        email: identity.email ?? '',
        firstName: identity.givenName ?? '',
        lastName: identity.familyName ?? '',
        imageUrl: identity.pictureUrl ?? null,
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      return { userId }
    } catch (error) {
      console.error('Error ensuring user', error)
      return { error: 'USER_ENSURE_FAILED' }
    }
  },
})

export const upsertFromClerk = internalMutation({
  args: {
    externalId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    imageUrl: v.nullable(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: Id<'users'> } | { error: string }> => {
    const existingUser = await getByExternalId(ctx, args.externalId)

    if (existingUser) {
      try {
        await ctx.db.patch(existingUser._id, {
          email: args.email,
          firstName: args.firstName,
          lastName: args.lastName,
          imageUrl: args.imageUrl,
          updatedAt: Date.now(),
        })

        return {
          userId: existingUser._id,
        }
      } catch (error) {
        console.error('Error updating user', error)

        return {
          error: 'USER_UPDATE_FAILED',
        }
      }
    }

    try {
      const insertedUserId = await ctx.db.insert('users', {
        externalId: args.externalId,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        imageUrl: args.imageUrl,
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      return {
        userId: insertedUserId,
      }
    } catch (error) {
      console.error('Error inserting user', error)

      return {
        error: 'USER_INSERT_FAILED',
      }
    }
  },
})

export const markAsDeleted = internalMutation({
  args: { externalId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    { deleted: true; alreadyDeleted?: boolean } | { error: string }
  > => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_externalId', (q) => q.eq('externalId', args.externalId))
      .unique()

    if (!user) {
      console.warn('markAsDeleted called for non-existent user', {
        externalId: args.externalId,
      })
      return { deleted: true, alreadyDeleted: true }
    }

    if (user.deleted) {
      return { deleted: true, alreadyDeleted: true }
    }

    try {
      await ctx.db.patch(user._id, {
        deleted: true,
        updatedAt: Date.now(),
      })

      return { deleted: true }
    } catch (error) {
      console.error('Error marking user as deleted', error)

      return {
        error: 'USER_DELETE_FAILED',
      }
    }
  },
})
