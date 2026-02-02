import { v } from "convex/values";
import { Id } from "convex/_generated/dataModel";
import { mutation, internalMutation } from "convex/_generated/server";
import { internal } from "convex/_generated/api";

import { getByExternalId } from "../user/helpers";
import {
    getItemByIdForUser,
    getItemByUrlForUser,
    getTagByIdForUser,
    getTagByNameForUser,
    getItemTagRelation,
    getItemTagsForItem,
    getItemTagsForTag,
} from "./helpers";
import { isValidUrl, normalizeUrl } from "./utils";

// ============================================================================
// Item Mutations (Public)
// ============================================================================

export const createItem = mutation({
    args: { url: v.string() },
    handler: async (ctx, args): Promise<{ itemId: Id<"items"> } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        if (!isValidUrl(args.url)) {
            return { error: "INVALID_URL" };
        }

        const normalizedUrl = normalizeUrl(args.url);

        // Check for existing item with same URL
        const existingItem = await getItemByUrlForUser(ctx, normalizedUrl, user._id);
        if (existingItem) {
            return { error: "DUPLICATE_URL" };
        }

        const now = Date.now();
        const itemId = await ctx.db.insert("items", {
            userId: user._id,
            url: normalizedUrl,
            status: "pending",
            archived: false,
            deleted: false,
            createdAt: now,
            updatedAt: now,
        });

        // Schedule the background action to fetch metadata
        await ctx.scheduler.runAfter(0, internal.modules.items.actions.fetchItemMetadata, {
            itemId,
        });

        return { itemId };
    },
});

export const updateItem = mutation({
    args: {
        itemId: v.id("items"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        const updates: Record<string, unknown> = { updatedAt: Date.now() };
        if (args.title !== undefined) updates.title = args.title;
        if (args.description !== undefined) updates.description = args.description;

        await ctx.db.patch(args.itemId, updates);
        return { success: true };
    },
});

export const setItemArchived = mutation({
    args: {
        itemId: v.id("items"),
        archived: v.boolean(),
    },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        await ctx.db.patch(args.itemId, {
            archived: args.archived,
            updatedAt: Date.now(),
        });
        return { success: true };
    },
});

export const deleteItem = mutation({
    args: { itemId: v.id("items") },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        // Clean up itemTags relationships
        const itemTags = await getItemTagsForItem(ctx, args.itemId);
        for (const itemTag of itemTags) {
            await ctx.db.delete(itemTag._id);
        }

        // Soft delete the item
        await ctx.db.patch(args.itemId, {
            deleted: true,
            updatedAt: Date.now(),
        });
        return { success: true };
    },
});

export const retryItemFetch = mutation({
    args: { itemId: v.id("items") },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        if (item.status !== "failed") {
            return { error: "ITEM_NOT_FAILED" };
        }

        await ctx.db.patch(args.itemId, {
            status: "pending",
            statusMessage: undefined,
            updatedAt: Date.now(),
        });

        // Schedule the background action to fetch metadata
        await ctx.scheduler.runAfter(0, internal.modules.items.actions.fetchItemMetadata, {
            itemId: args.itemId,
        });

        return { success: true };
    },
});

// ============================================================================
// Item Mutations (Internal - called by actions)
// ============================================================================

export const updateItemMetadata = internalMutation({
    args: {
        itemId: v.id("items"),
        title: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
        ),
        statusMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const updates: Record<string, unknown> = {
            status: args.status,
            updatedAt: Date.now(),
        };

        if (args.title !== undefined) updates.title = args.title;
        if (args.description !== undefined) updates.description = args.description;
        if (args.statusMessage !== undefined) {
            updates.statusMessage = args.statusMessage;
        } else if (args.status === "completed") {
            // Clear status message on success
            updates.statusMessage = undefined;
        }

        await ctx.db.patch(args.itemId, updates);
    },
});

export const setItemProcessing = internalMutation({
    args: { itemId: v.id("items") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.itemId, {
            status: "processing",
            updatedAt: Date.now(),
        });
    },
});

// ============================================================================
// Tag Mutations (Public)
// ============================================================================

export const createTag = mutation({
    args: {
        name: v.string(),
        color: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ tagId: Id<"tags"> } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const trimmedName = args.name.trim();
        if (!trimmedName) {
            return { error: "TAG_NAME_REQUIRED" };
        }

        // Check for existing tag with same name
        const existingTag = await getTagByNameForUser(ctx, trimmedName, user._id);
        if (existingTag) {
            return { error: "DUPLICATE_TAG_NAME" };
        }

        const now = Date.now();
        const tagId = await ctx.db.insert("tags", {
            userId: user._id,
            name: trimmedName,
            color: args.color,
            deleted: false,
            createdAt: now,
            updatedAt: now,
        });

        return { tagId };
    },
});

export const updateTag = mutation({
    args: {
        tagId: v.id("tags"),
        name: v.optional(v.string()),
        color: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const tag = await getTagByIdForUser(ctx, args.tagId, user._id);
        if (!tag) return { error: "TAG_NOT_FOUND" };

        const updates: Record<string, unknown> = { updatedAt: Date.now() };

        if (args.name !== undefined) {
            const trimmedName = args.name.trim();
            if (!trimmedName) {
                return { error: "TAG_NAME_REQUIRED" };
            }

            // Check for existing tag with same name (excluding current)
            const existingTag = await getTagByNameForUser(ctx, trimmedName, user._id);
            if (existingTag && existingTag._id !== args.tagId) {
                return { error: "DUPLICATE_TAG_NAME" };
            }

            updates.name = trimmedName;
        }

        if (args.color !== undefined) {
            updates.color = args.color;
        }

        await ctx.db.patch(args.tagId, updates);
        return { success: true };
    },
});

export const deleteTag = mutation({
    args: { tagId: v.id("tags") },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const tag = await getTagByIdForUser(ctx, args.tagId, user._id);
        if (!tag) return { error: "TAG_NOT_FOUND" };

        // Clean up itemTags relationships
        const itemTags = await getItemTagsForTag(ctx, args.tagId);
        for (const itemTag of itemTags) {
            await ctx.db.delete(itemTag._id);
        }

        // Soft delete the tag
        await ctx.db.patch(args.tagId, {
            deleted: true,
            updatedAt: Date.now(),
        });
        return { success: true };
    },
});

// ============================================================================
// Item-Tag Mutations (Public)
// ============================================================================

export const addTagToItem = mutation({
    args: {
        itemId: v.id("items"),
        tagId: v.id("tags"),
    },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        const tag = await getTagByIdForUser(ctx, args.tagId, user._id);
        if (!tag) return { error: "TAG_NOT_FOUND" };

        // Check if relationship already exists
        const existingRelation = await getItemTagRelation(ctx, args.itemId, args.tagId);
        if (existingRelation) {
            return { error: "TAG_ALREADY_ADDED" };
        }

        await ctx.db.insert("itemTags", {
            itemId: args.itemId,
            tagId: args.tagId,
            createdAt: Date.now(),
        });

        return { success: true };
    },
});

export const removeTagFromItem = mutation({
    args: {
        itemId: v.id("items"),
        tagId: v.id("tags"),
    },
    handler: async (ctx, args): Promise<{ success: true } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        const tag = await getTagByIdForUser(ctx, args.tagId, user._id);
        if (!tag) return { error: "TAG_NOT_FOUND" };

        const relation = await getItemTagRelation(ctx, args.itemId, args.tagId);
        if (!relation) {
            return { error: "TAG_NOT_ON_ITEM" };
        }

        await ctx.db.delete(relation._id);
        return { success: true };
    },
});

export const createAndAddTag = mutation({
    args: {
        itemId: v.id("items"),
        tagName: v.string(),
        tagColor: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<{ tagId: Id<"tags">; created: boolean } | { error: string }> => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) return { error: "UNAUTHORIZED" };

        const user = await getByExternalId(ctx, identity.subject);
        if (!user) return { error: "USER_NOT_FOUND" };

        const item = await getItemByIdForUser(ctx, args.itemId, user._id);
        if (!item) return { error: "ITEM_NOT_FOUND" };

        const trimmedName = args.tagName.trim();
        if (!trimmedName) {
            return { error: "TAG_NAME_REQUIRED" };
        }

        // Check if tag already exists
        let tag = await getTagByNameForUser(ctx, trimmedName, user._id);
        let created = false;

        if (!tag) {
            // Create the tag
            const now = Date.now();
            const tagId = await ctx.db.insert("tags", {
                userId: user._id,
                name: trimmedName,
                color: args.tagColor,
                deleted: false,
                createdAt: now,
                updatedAt: now,
            });
            tag = (await ctx.db.get(tagId))!;
            created = true;
        }

        // Check if relationship already exists
        const existingRelation = await getItemTagRelation(ctx, args.itemId, tag._id);
        if (!existingRelation) {
            await ctx.db.insert("itemTags", {
                itemId: args.itemId,
                tagId: tag._id,
                createdAt: Date.now(),
            });
        }

        return { tagId: tag._id, created };
    },
});
