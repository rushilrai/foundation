import { v } from 'convex/values'

export const ratingValidator = v.object({
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
})
