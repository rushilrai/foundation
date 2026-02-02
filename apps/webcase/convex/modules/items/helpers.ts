import { Doc, Id } from "convex/_generated/dataModel";
import { MutationCtx, QueryCtx } from "convex/_generated/server";

import { normalizeUrl } from "./utils";

/**
 * Get an item by ID, respecting soft delete
 */
export async function getItemById(
    ctx: QueryCtx | MutationCtx,
    itemId: Id<"items">
): Promise<Doc<"items"> | null> {
    const item = await ctx.db.get(itemId);
    if (!item || item.deleted) {
        return null;
    }
    return item;
}

/**
 * Get an item by ID with ownership check
 */
export async function getItemByIdForUser(
    ctx: QueryCtx | MutationCtx,
    itemId: Id<"items">,
    userId: Id<"users">
): Promise<Doc<"items"> | null> {
    const item = await getItemById(ctx, itemId);
    if (!item || item.userId !== userId) {
        return null;
    }
    return item;
}

/**
 * Get an item by URL for a specific user (for duplicate detection)
 * Normalizes the URL before comparing
 */
export async function getItemByUrlForUser(
    ctx: QueryCtx | MutationCtx,
    url: string,
    userId: Id<"users">
): Promise<Doc<"items"> | null> {
    const normalizedUrl = normalizeUrl(url);
    const item = await ctx.db
        .query("items")
        .withIndex("by_url_userId", (q) =>
            q.eq("url", normalizedUrl).eq("userId", userId)
        )
        .first();

    if (!item || item.deleted) {
        return null;
    }
    return item;
}

/**
 * Get a tag by ID, respecting soft delete
 */
export async function getTagById(
    ctx: QueryCtx | MutationCtx,
    tagId: Id<"tags">
): Promise<Doc<"tags"> | null> {
    const tag = await ctx.db.get(tagId);
    if (!tag || tag.deleted) {
        return null;
    }
    return tag;
}

/**
 * Get a tag by ID with ownership check
 */
export async function getTagByIdForUser(
    ctx: QueryCtx | MutationCtx,
    tagId: Id<"tags">,
    userId: Id<"users">
): Promise<Doc<"tags"> | null> {
    const tag = await getTagById(ctx, tagId);
    if (!tag || tag.userId !== userId) {
        return null;
    }
    return tag;
}

/**
 * Get a tag by name for a specific user (for uniqueness checking)
 */
export async function getTagByNameForUser(
    ctx: QueryCtx | MutationCtx,
    name: string,
    userId: Id<"users">
): Promise<Doc<"tags"> | null> {
    const tag = await ctx.db
        .query("tags")
        .withIndex("by_userId_name", (q) =>
            q.eq("userId", userId).eq("name", name)
        )
        .first();

    if (!tag || tag.deleted) {
        return null;
    }
    return tag;
}

/**
 * Get all tags for an item
 */
export async function getTagsForItem(
    ctx: QueryCtx | MutationCtx,
    itemId: Id<"items">
): Promise<Doc<"tags">[]> {
    const itemTags = await ctx.db
        .query("itemTags")
        .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
        .collect();

    const tags: Doc<"tags">[] = [];
    for (const itemTag of itemTags) {
        const tag = await getTagById(ctx, itemTag.tagId);
        if (tag) {
            tags.push(tag);
        }
    }
    return tags;
}

/**
 * Check if an item-tag relationship exists
 */
export async function getItemTagRelation(
    ctx: QueryCtx | MutationCtx,
    itemId: Id<"items">,
    tagId: Id<"tags">
): Promise<Doc<"itemTags"> | null> {
    return await ctx.db
        .query("itemTags")
        .withIndex("by_itemId_tagId", (q) =>
            q.eq("itemId", itemId).eq("tagId", tagId)
        )
        .first();
}

/**
 * Get all itemTag relations for an item (for cleanup during deletion)
 */
export async function getItemTagsForItem(
    ctx: QueryCtx | MutationCtx,
    itemId: Id<"items">
): Promise<Doc<"itemTags">[]> {
    return await ctx.db
        .query("itemTags")
        .withIndex("by_itemId", (q) => q.eq("itemId", itemId))
        .collect();
}

/**
 * Get all itemTag relations for a tag (for cleanup during deletion)
 */
export async function getItemTagsForTag(
    ctx: QueryCtx | MutationCtx,
    tagId: Id<"tags">
): Promise<Doc<"itemTags">[]> {
    return await ctx.db
        .query("itemTags")
        .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
        .collect();
}
