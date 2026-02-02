import { defineTable } from "convex/server";
import { v } from "convex/values";

export const patchFields = {
    resumeId: v.id("resumes"),
    userId: v.id("users"),
    title: v.string(),
    jobDescription: v.string(),
    companyName: v.string(),
    roleName: v.string(),
    streamingText: v.nullable(v.string()),
    patchedFileId: v.nullable(v.id("_storage")),
    changes: v.nullable(v.array(v.string())),
    status: v.union(v.literal("generating"), v.literal("ready"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    deleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
}

export const patchTable = defineTable(patchFields)
    .index("by_resumeId", ["resumeId"])
    .index("by_userId", ["userId"])
    .index("by_resumeId_deleted", ["resumeId", "deleted"])
    .index("by_userId_deleted", ["userId", "deleted"])
