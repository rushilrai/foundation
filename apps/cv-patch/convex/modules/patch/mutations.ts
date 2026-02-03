import { internal } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { internalMutation, mutation } from "convex/_generated/server";
import { v } from "convex/values";

import { getById as getResumeById } from "../resume/helpers";
import { getByExternalId } from "../user/helpers";
import { getByIdWithAuth } from "./helpers";

export const create = mutation({
    args: {
        resumeId: v.id("resumes"),
        title: v.string(),
        jobDescription: v.string(),
        companyName: v.string(),
        roleName: v.string(),
    },
    handler: async (ctx, args): Promise<{ patchId: Id<"patches"> } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { error: "UNAUTHORIZED" };
        }

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) {
            return { error: "USER_NOT_FOUND" };
        }

        const resume = await getResumeById(ctx, args.resumeId);
        if (!resume) {
            return { error: "RESUME_NOT_FOUND" };
        }

        if (resume.userId !== user._id) {
            return { error: "FORBIDDEN" };
        }

        if (resume.status !== "ready") {
            return { error: "RESUME_NOT_READY" };
        }

        try {
            const patchId = await ctx.db.insert("patches", {
                resumeId: args.resumeId,
                userId: user._id,
                title: args.title,
                jobDescription: args.jobDescription,
                companyName: args.companyName,
                roleName: args.roleName,
                streamingText: null,
                templateId: "resume-v1",
                data: null,
                patchedFileId: null,
                changes: null,
                status: "generating",
                deleted: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });

            await ctx.scheduler.runAfter(0, internal.modules.patch.nodeActions.generatePatch, {
                patchId,
            });

            return { patchId };
        } catch (error) {
            console.error("Error creating patch", error);
            return { error: "PATCH_CREATE_FAILED" };
        }
    },
});

export const remove = mutation({
    args: { patchId: v.id("patches") },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const result = await getByIdWithAuth(ctx, args.patchId);

        if ("error" in result) {
            return result;
        }

        try {
            await ctx.db.patch(args.patchId, {
                deleted: true,
                updatedAt: Date.now(),
            });

            return { success: true };
        } catch (error) {
            console.error("Error deleting patch", error);
            return { error: "PATCH_DELETE_FAILED" };
        }
    },
});

export const updateStreamingText = internalMutation({
    args: {
        patchId: v.id("patches"),
        streamingText: v.string(),
    },
    handler: async (ctx, args): Promise<void> => {
        await ctx.db.patch(args.patchId, {
            streamingText: args.streamingText,
        });
    },
});

export const updateGeneratedContent = internalMutation({
    args: {
        patchId: v.id("patches"),
        patchedFileId: v.nullable(v.id("_storage")),
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
        changes: v.nullable(v.array(v.string())),
        status: v.union(v.literal("ready"), v.literal("error")),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<void> => {
        await ctx.db.patch(args.patchId, {
            streamingText: null,
            patchedFileId: args.patchedFileId,
            data: args.data,
            changes: args.changes,
            status: args.status,
            errorMessage: args.errorMessage,
            updatedAt: Date.now(),
        });
    },
});
