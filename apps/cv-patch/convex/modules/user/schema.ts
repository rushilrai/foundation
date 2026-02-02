import { defineTable } from "convex/server";
import { v } from "convex/values";

export const userFields = {
    externalId: v.string(),
    email: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    imageUrl: v.nullable(v.string()),
    deleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
}

export const userTable = defineTable(userFields)
    .index("by_externalId", ["externalId"])
    .index("by_email", ["email"])