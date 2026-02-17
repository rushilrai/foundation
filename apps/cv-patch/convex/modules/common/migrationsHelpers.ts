import { internalQuery } from 'convex/_generated/server'
import type { Doc } from 'convex/_generated/dataModel'

export const getResumesWithoutPdf = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<Doc<'resumes'>>> => {
    const resumes = await ctx.db
      .query('resumes')
      .filter((q) =>
        q.and(
          q.eq(q.field('deleted'), false),
          q.eq(q.field('status'), 'ready'),
          q.or(
            q.eq(q.field('pdfFileId'), undefined),
            q.eq(q.field('pdfFileId'), null),
          ),
        ),
      )
      .collect()

    return resumes
  },
})

export const getPatchesWithoutPdf = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<Doc<'patches'>>> => {
    const patches = await ctx.db
      .query('patches')
      .filter((q) =>
        q.and(
          q.eq(q.field('deleted'), false),
          q.eq(q.field('status'), 'ready'),
          q.or(
            q.eq(q.field('pdfFileId'), undefined),
            q.eq(q.field('pdfFileId'), null),
          ),
        ),
      )
      .collect()

    return patches
  },
})
