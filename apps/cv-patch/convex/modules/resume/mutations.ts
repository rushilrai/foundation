import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { internalMutation, mutation } from '../../_generated/server'
import { MAX_HEADER_LINKS } from '../../../shared/resumeSchema'
import { rateLimiter } from '../../configs/rateLimiter'
import {
  nullableResumeDataValidator,
  resumeDataValidator,
} from '../common/resumeData'
import { getByExternalId } from '../user/helpers'
import { getByIdWithAuth } from './helpers'

export const create = mutation({
  args: {
    title: v.string(),
    fileId: v.id('_storage'),
    fileName: v.string(),
    fileSize: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ resumeId: Id<'resumes'> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return { error: 'UNAUTHORIZED' }
    }

    const user = await getByExternalId(ctx, identity.subject)
    if (!user) {
      return { error: 'USER_NOT_FOUND' }
    }

    try {
      const resumeId = await ctx.db.insert('resumes', {
        userId: user._id,
        title: args.title,
        fileId: args.fileId,
        pdfFileId: null,
        fileName: args.fileName,
        fileSize: args.fileSize,
        templateId: 'resume-v1',
        data: null,
        rawText: '',
        status: 'processing',
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })

      await ctx.scheduler.runAfter(
        0,
        internal.modules.resume.nodeActions.extractResumeData,
        {
          resumeId,
        },
      )

      return { resumeId }
    } catch (error) {
      console.error('Error creating resume', error)
      return { error: 'RESUME_CREATE_FAILED' }
    }
  },
})

export const update = mutation({
  args: {
    resumeId: v.id('resumes'),
    title: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.resumeId)

    if ('error' in result) {
      return result
    }

    try {
      await ctx.db.patch(args.resumeId, {
        ...(args.title !== undefined && { title: args.title }),
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error updating resume', error)
      return { error: 'RESUME_UPDATE_FAILED' }
    }
  },
})

export const remove = mutation({
  args: { resumeId: v.id('resumes') },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.resumeId)

    if ('error' in result) {
      return result
    }

    try {
      await ctx.db.patch(args.resumeId, {
        deleted: true,
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error deleting resume', error)
      return { error: 'RESUME_DELETE_FAILED' }
    }
  },
})

export const updateExtractedContent = internalMutation({
  args: {
    resumeId: v.id('resumes'),
    data: nullableResumeDataValidator,
    rawText: v.string(),
    status: v.union(v.literal('ready'), v.literal('error')),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.resumeId, {
      data: args.data,
      rawText: args.rawText,
      status: args.status,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    })
  },
})

export const requestRating = mutation({
  args: { resumeId: v.id('resumes') },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.resumeId)

    if ('error' in result) {
      return result
    }

    if (result.resume.status !== 'ready' || !result.resume.data) {
      return { error: 'RESUME_NOT_READY' }
    }

    const { ok } = await rateLimiter.limit(ctx, 'rateResume', {
      key: result.user._id,
    })
    if (!ok) {
      return { error: 'RATE_LIMITED' }
    }

    try {
      await ctx.scheduler.runAfter(
        0,
        internal.modules.resume.nodeActions.rateResume,
        { resumeId: args.resumeId },
      )

      return { success: true }
    } catch (error) {
      console.error('Error requesting resume rating', error)
      return { error: 'RATING_REQUEST_FAILED' }
    }
  },
})

export const updateRating = internalMutation({
  args: {
    resumeId: v.id('resumes'),
    rating: v.object({
      overall: v.number(),
      categories: v.array(
        v.object({
          name: v.string(),
          score: v.number(),
          comments: v.string(),
        }),
      ),
      suggestions: v.array(v.string()),
      ratedAt: v.number(),
    }),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.resumeId, {
      rating: args.rating,
      updatedAt: Date.now(),
    })
  },
})

export const updatePdfFileId = internalMutation({
  args: {
    resumeId: v.id('resumes'),
    pdfFileId: v.nullable(v.id('_storage')),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.resumeId, {
      pdfFileId: args.pdfFileId,
      updatedAt: Date.now(),
    })
  },
})

export const updateData = mutation({
  args: {
    resumeId: v.id('resumes'),
    data: resumeDataValidator,
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true } | { error: string }> => {
    const result = await getByIdWithAuth(ctx, args.resumeId)

    if ('error' in result) {
      return result
    }

    if (args.data.header.links.length > MAX_HEADER_LINKS) {
      return { error: 'TOO_MANY_HEADER_LINKS' }
    }

    try {
      await ctx.db.patch(args.resumeId, {
        data: args.data,
        updatedAt: Date.now(),
      })

      return { success: true }
    } catch (error) {
      console.error('Error updating resume data', error)
      return { error: 'RESUME_DATA_UPDATE_FAILED' }
    }
  },
})
