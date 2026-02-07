import { internalMutation } from 'convex/_generated/server'
import { v } from 'convex/values'

import { getByExternalId } from './helpers'
import type { Id } from 'convex/_generated/dataModel'

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
