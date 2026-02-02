import { v } from "convex/values";
import { Doc } from "convex/_generated/dataModel";
import { query } from "convex/_generated/server";

import { getByExternalId } from "../user/helpers";
import { getItemByIdForUser, getTagsForItem } from "./helpers";

type ItemWithTags = Doc<"items"> & { tags: Doc<"tags">[] };

export const listItems = query({
    args: {
        archived: v.optional(v.boolean()),
        tagId: v.optional(v.id("tags")),
        limit: v.optional(v.number()),
        cursor: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ items: ItemWithTags[]; nextCursor: string | null } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const limit = args.limit ?? 50;

        let itemsQuery;

        if (args.archived !== undefined) {
            itemsQuery = ctx.db
                .query("items")
                .withIndex("by_userId_archived", (q) =>
                    q.eq("userId", user._id).eq("archived", args.archived!)
                );
        } else {
            itemsQuery = ctx.db
                .query("items")
                .withIndex("by_userId", (q) => q.eq("userId", user._id));
        }

        // Apply cursor pagination
        const paginatedItems = await itemsQuery
            .order("desc")
            .paginate({ numItems: limit, cursor: args.cursor ?? null });

        // Filter out deleted items and filter by tag if specified
        const filteredItems: Doc<"items">[] = [];
        for (const item of paginatedItems.page) {
            if (item.deleted) continue;

            if (args.tagId) {
                const tags = await getTagsForItem(ctx, item._id);
                const hasTag = tags.some((t) => t._id === args.tagId);
                if (!hasTag) continue;
            }

            filteredItems.push(item);
        }

        // Attach tags to each item
        const itemsWithTags: ItemWithTags[] = [];
        for (const item of filteredItems) {
            const tags = await getTagsForItem(ctx, item._id);
            itemsWithTags.push({ ...item, tags });
        }

        return {
            items: itemsWithTags,
            nextCursor: paginatedItems.isDone ? null : paginatedItems.continueCursor,
        };
    },
});

export const getItem = query({
    args: { itemId: v.id("items") },
    handler: async (ctx, args): Promise<{ item: ItemWithTags } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        const tags = await getTagsForItem(ctx, args.itemId);

        return { item: { ...item, tags } };
    },
});

export const listTags = query({
    args: {},
    handler: async (ctx): Promise<{ tags: Doc<"tags">[] } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const tags = await ctx.db
            .query("tags")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .filter((q) => q.eq(q.field("deleted"), false))
            .collect();

        return { tags };
    },
});

export const getItemCounts = query({
    args: {},
    handler: async (ctx): Promise<{ unread: number; archived: number; total: number } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const items = await ctx.db
            .query("items")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .filter((q) => q.eq(q.field("deleted"), false))
            .collect();

        let unread = 0;
        let archived = 0;

        for (const item of items) {
            if (item.archived) {
                archived++;
            } else {
                unread++;
            }
        }

        return {
            unread,
            archived,
            total: items.length,
        };
    },
});

export const searchItems = query({
    args: {
        searchTerm: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args): Promise<{ items: ItemWithTags[] } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const limit = args.limit ?? 20;
        const searchTermLower = args.searchTerm.toLowerCase();

        // Get all user's items and filter by search term
        // Note: For production, consider using a search index
        const allItems = await ctx.db
            .query("items")
            .withIndex("by_userId", (q) => q.eq("userId", user._id))
            .filter((q) => q.eq(q.field("deleted"), false))
            .collect();

        const matchingItems: Doc<"items">[] = [];
        for (const item of allItems) {
            if (matchingItems.length >= limit) break;

            const titleMatch = item.title?.toLowerCase().includes(searchTermLower);
            const descMatch = item.description?.toLowerCase().includes(searchTermLower);
            const urlMatch = item.url.toLowerCase().includes(searchTermLower);

            if (titleMatch || descMatch || urlMatch) {
                matchingItems.push(item);
            }
        }

        // Attach tags to matching items
        const itemsWithTags: ItemWithTags[] = [];
        for (const item of matchingItems) {
            const tags = await getTagsForItem(ctx, item._id);
            itemsWithTags.push({ ...item, tags });
        }

        return { items: itemsWithTags };
    },
});
