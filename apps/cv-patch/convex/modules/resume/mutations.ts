import { internal } from 'convex/_generated/api'
import { internalMutation, mutation } from 'convex/_generated/server'
import { v } from 'convex/values'

import { getByExternalId } from '../user/helpers'
import { getByIdWithAuth } from './helpers'
import type { Id } from 'convex/_generated/dataModel'

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
    data: v.union(
      v.null(),
      v.object({
        header: v.object({
          name: v.string(),
          phone: v.string(),
          email: v.string(),
          linkedin: v.string(),
        }),
        education: v.array(
          v.object({
            school: v.string(),
            location: v.string(),
            dates: v.string(),
            degree: v.string(),
            details: v.string(),
          }),
        ),
        experience: v.array(
          v.object({
            company: v.string(),
            companyMeta: v.string(),
            roles: v.array(
              v.object({
                title: v.string(),
                meta: v.string(),
                bullets: v.array(v.string()),
              }),
            ),
          }),
        ),
        projects: v.array(
          v.object({
            name: v.string(),
            dates: v.string(),
            bullets: v.array(v.string()),
          }),
        ),
        skills: v.object({
          technical: v.string(),
          financial: v.string(),
          languages: v.string(),
        }),
        extras: v.array(v.string()),
      }),
    ),
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

export const updateData = mutation({
  args: {
    resumeId: v.id('resumes'),
    data: v.object({
      header: v.object({
        name: v.string(),
        phone: v.string(),
        email: v.string(),
        linkedin: v.string(),
      }),
      education: v.array(
        v.object({
          school: v.string(),
          location: v.string(),
          dates: v.string(),
          degree: v.string(),
          details: v.string(),
        }),
      ),
      experience: v.array(
        v.object({
          company: v.string(),
          companyMeta: v.string(),
          roles: v.array(
            v.object({
              title: v.string(),
              meta: v.string(),
              bullets: v.array(v.string()),
            }),
          ),
        }),
      ),
      projects: v.array(
        v.object({
          name: v.string(),
          dates: v.string(),
          bullets: v.array(v.string()),
        }),
      ),
      skills: v.object({
        technical: v.string(),
        financial: v.string(),
        languages: v.string(),
      }),
      extras: v.array(v.string()),
    }),
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
