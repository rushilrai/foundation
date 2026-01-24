import { mutation } from "convex/_generated/server";

export const syncUser = mutation({
    args: {},
    handler: async (ctx) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return null;

        const existingUser = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
            .unique();

        if (existingUser) {
            await ctx.db.patch(existingUser._id, {
                email: identity.email,
                name: identity.name,
                imageUrl: identity.pictureUrl,
                updatedAt: Date.now(),
            });
            return existingUser._id;
        }

        return await ctx.db.insert("users", {
            clerkId: identity.subject,
            email: identity.email,
            name: identity.name,
            imageUrl: identity.pictureUrl,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});