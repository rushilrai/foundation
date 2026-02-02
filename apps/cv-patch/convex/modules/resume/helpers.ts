import type { Doc, Id } from "convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "convex/_generated/server";

import { getByExternalId } from "../user/helpers";


export const getById = async (ctx: QueryCtx | MutationCtx, resumeId: Id<"resumes">) => {
    const resume = await ctx.db.get(resumeId);

    if (!resume || resume.deleted) {
        return null;
    }

    return resume;
}

export const getByIdWithAuth = async (
    ctx: QueryCtx | MutationCtx,
    resumeId: Id<"resumes">
): Promise<{ resume: Doc<"resumes">; user: Doc<"users"> } | { error: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
        return { error: "UNAUTHORIZED" };
    }

    const user = await getByExternalId(ctx, identity.subject);
    if (!user) {
        return { error: "USER_NOT_FOUND" };
    }

    const resume = await getById(ctx, resumeId);
    if (!resume) {
        return { error: "RESUME_NOT_FOUND" };
    }

    if (resume.userId !== user._id) {
        return { error: "FORBIDDEN" };
    }

    return { resume, user };
}

export const getUserResumes = async (ctx: QueryCtx | MutationCtx, userId: Id<"users">) => {
    const resumes = await ctx.db
        .query("resumes")
        .withIndex("by_userId_deleted", (q) => q.eq("userId", userId).eq("deleted", false))
        .order("desc")
        .collect();

    return resumes;
}
