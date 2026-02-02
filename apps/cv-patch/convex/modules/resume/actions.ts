import { internal } from "convex/_generated/api";
import { action } from "convex/_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = action({
    args: {},
    handler: async (ctx): Promise<{ uploadUrl: string } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { error: "UNAUTHORIZED" };
        }

        try {
            const uploadUrl = await ctx.storage.generateUploadUrl();
            return { uploadUrl };
        } catch (error) {
            console.error("Error generating upload URL", error);
            return { error: "UPLOAD_URL_GENERATION_FAILED" };
        }
    },
});

export const generateDownloadUrl = action({
    args: { resumeId: v.id("resumes") },
    handler: async (ctx, args): Promise<{ downloadUrl: string } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { error: "UNAUTHORIZED" };
        }

        const resume = await ctx.runQuery(internal.modules.resume.queries.getByIdInternal, {
            resumeId: args.resumeId,
        });

        if (!resume) {
            return { error: "RESUME_NOT_FOUND" };
        }

        try {
            const downloadUrl = await ctx.storage.getUrl(resume.fileId);
            if (!downloadUrl) {
                return { error: "DOWNLOAD_URL_GENERATION_FAILED" };
            }

            return { downloadUrl };
        } catch (error) {
            console.error("Error generating download URL", error);
            return { error: "DOWNLOAD_URL_GENERATION_FAILED" };
        }
    },
});
