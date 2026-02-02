import type { Doc } from "convex/_generated/dataModel";
import { internalQuery, query } from "convex/_generated/server";
import { v } from "convex/values";

import { getByExternalId } from "../user/helpers";
import { getById, getByIdWithAuth, getUserResumes } from "./helpers";

export const list = query({
    args: {},
    handler: async (ctx): Promise<{ resumes: Array<Doc<"resumes">> } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) {
            return { error: "UNAUTHORIZED" };
        }

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) {
            return { error: "USER_NOT_FOUND" };
        }

        const resumes = await getUserResumes(ctx, user._id);

        return { resumes };
    },
});

export const get = query({
    args: { resumeId: v.id("resumes") },
    handler: async (ctx, args): Promise<{ resume: Doc<"resumes"> } | { error: string }> => {
        const result = await getByIdWithAuth(ctx, args.resumeId);

        if ("error" in result) {
            return result;
        }

        return { resume: result.resume };
    },
});

export const getByIdInternal = internalQuery({
    args: { resumeId: v.id("resumes") },
    handler: async (ctx, args): Promise<Doc<"resumes"> | null> => {
        return await getById(ctx, args.resumeId);
    },
});
