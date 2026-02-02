import { defineTable } from "convex/server";
import { v } from "convex/values";

export const itemFields = {
    userId: v.id("users"),
    url: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    llmSummary: v.optional(v.string()),
    status: v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
    ),
    statusMessage: v.optional(v.string()),
    archived: v.boolean(),
    deleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
};

export const itemTable = defineTable(itemFields)
    .index("by_userId", ["userId"])
    .index("by_userId_archived", ["userId", "archived"])
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_url_userId", ["url", "userId"]);

export const tagFields = {
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()),
    deleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
};

export const tagTable = defineTable(tagFields)
    .index("by_userId", ["userId"])
    .index("by_userId_name", ["userId", "name"]);

export const itemTagFields = {
    itemId: v.id("items"),
    tagId: v.id("tags"),
    createdAt: v.number(),
};

export const itemTagTable = defineTable(itemTagFields)
    .index("by_itemId", ["itemId"])
    .index("by_tagId", ["tagId"])
    .index("by_itemId_tagId", ["itemId", "tagId"]);
