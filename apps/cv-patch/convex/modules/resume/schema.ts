import { defineTable } from "convex/server";
import { v } from "convex/values";

export const resumeFields = {
    userId: v.id("users"),
    title: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    templateId: v.string(),
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
                })
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
                        })
                    ),
                })
            ),
            projects: v.array(
                v.object({
                    name: v.string(),
                    dates: v.string(),
                    bullets: v.array(v.string()),
                })
            ),
            skills: v.object({
                technical: v.string(),
                financial: v.string(),
                languages: v.string(),
            }),
            extras: v.array(v.string()),
        })
    ),
    rawText: v.string(),
    status: v.union(v.literal("processing"), v.literal("ready"), v.literal("error")),
    errorMessage: v.optional(v.string()),
    deleted: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
}

export const resumeTable = defineTable(resumeFields)
    .index("by_userId", ["userId"])
    .index("by_userId_deleted", ["userId", "deleted"])
    .index("by_fileId", ["fileId"])
