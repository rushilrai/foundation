import { v } from "convex/values";
import { internalQuery } from "convex/_generated/server";

/**
 * Internal query to get item data for actions
 * Does not respect soft delete - actions need to see all items
 */
export const getItemInternal = internalQuery({
    args: { itemId: v.id("items") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.itemId);
    },
});
