import { v } from 'convex/values'

import type { Id } from '../../_generated/dataModel'
import { internalMutation, mutation } from '../../_generated/server'
import {
  getEmptyProfileData,
  type ProfileData,
} from '../../../shared/profileSchema'
import { MAX_HEADER_LINKS } from '../../../shared/resumeSchema'
import { profileDataValidator } from '../common/profileData'
import { getByExternalId } from '../user/helpers'
import { getByIdWithAuth, getDocumentsForProfile } from './helpers'

export const create = mutation({
  args: {
    title: v.string(),
    roleBrief: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ profileId: Id<'profiles'> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    const data: ProfileData = {
      ...getEmptyProfileData(),
      roleBrief: args.roleBrief ?? '',
    }

    try {
      const profileId = await ctx.db.insert('profiles', {
        userId: user._id,
        title: args.title,
        data,
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      return { profileId }
    } catch (error) {
      console.error('Error creating profile', error)
      return { error: 'PROFILE_CREATE_FAILED' }
    }
  },
})

export const update = mutation({
  args: {
    profileId: v.id('profiles'),
    title: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    try {
      await ctx.db.patch(args.profileId, {
        ...(args.title !== undefined && { title: args.title }),
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error updating profile', error)
      return { error: 'PROFILE_UPDATE_FAILED' }
    }
  },
})

export const updateData = mutation({
  args: {
    profileId: v.id('profiles'),
    data: profileDataValidator,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    if (args.data.header.links.length > MAX_HEADER_LINKS) {
      return { error: 'TOO_MANY_HEADER_LINKS' }
    }

    try {
      await ctx.db.patch(args.profileId, {
        data: args.data,
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error updating profile data', error)
      return { error: 'PROFILE_DATA_UPDATE_FAILED' }
    }
  },
})

export const remove = mutation({
  args: { profileId: v.id('profiles') },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.profileId)

    if ('error' in result) {
      return result
    }

    try {
      await ctx.db.patch(args.profileId, {
        deleted: true,
        updatedAt: Date.now(),
      })

      // Documents are only reachable through their profile, so cascade the soft delete.
      const documents = await getDocumentsForProfile(ctx, args.profileId)
      for (const document of documents) {
        await ctx.db.patch(document._id, {
          deleted: true,
          updatedAt: Date.now(),
        })
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting profile', error)
      return { error: 'PROFILE_DELETE_FAILED' }
    }
  },
})

export const updateDataInternal = internalMutation({
  args: {
    profileId: v.id('profiles'),
    data: profileDataValidator,
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.data.header.links.length > MAX_HEADER_LINKS) {
      throw new Error('TOO_MANY_HEADER_LINKS')
    }

    await ctx.db.patch(args.profileId, {
      data: args.data,
      updatedAt: Date.now(),
    })
  },
})
