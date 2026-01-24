import { defineTable } from "convex/server";
import { v } from "convex/values";

export const userFields = {
    clerkId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
}

export const userTable = defineTable(userFields)
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])