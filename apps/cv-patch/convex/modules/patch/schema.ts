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
