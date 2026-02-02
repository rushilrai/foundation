"use node";

import { v } from "convex/values";
import { internalAction } from "convex/_generated/server";
import { internal } from "convex/_generated/api";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

const FETCH_TIMEOUT = 30000; // 30 seconds
const USER_AGENT = "Mozilla/5.0 (compatible; WebCase/1.0; +https://webcase.app)";

interface MetaData {
    title?: string;
    description?: string;
}

function extractMetadata(document: Document): MetaData {
    const metadata: MetaData = {};

    // Try Open Graph title first
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
        metadata.title = ogTitle.getAttribute("content") ?? undefined;
    }

    // Fallback to Twitter title
    if (!metadata.title) {
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) {
            metadata.title = twitterTitle.getAttribute("content") ?? undefined;
        }
    }

    // Fallback to document title
    if (!metadata.title) {
        const titleEl = document.querySelector("title");
        if (titleEl) {
            metadata.title = titleEl.textContent ?? undefined;
        }
    }

    // Try Open Graph description first
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
        metadata.description = ogDesc.getAttribute("content") ?? undefined;
    }

    // Fallback to Twitter description
    if (!metadata.description) {
        const twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) {
            metadata.description = twitterDesc.getAttribute("content") ?? undefined;
        }
    }

    // Fallback to meta description
    if (!metadata.description) {
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metadata.description = metaDesc.getAttribute("content") ?? undefined;
        }
    }

    return metadata;
}

export const fetchItemMetadata = internalAction({
    args: { itemId: v.id("items") },
    handler: async (ctx, args) => {
        // Get the item to fetch its URL
        const item = await ctx.runQuery(internal.modules.items.internalQueries.getItemInternal, {
            itemId: args.itemId,
        });

        if (!item) {
            console.error("Item not found:", args.itemId);
            return;
        }

        if (item.deleted) {
            console.log("Item was deleted, skipping fetch:", args.itemId);
            return;
        }

        // Set status to processing
        await ctx.runMutation(internal.modules.items.mutations.setItemProcessing, {
            itemId: args.itemId,
        });

        try {
            // Fetch the URL with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

            const response = await fetch(item.url, {
                signal: controller.signal,
                headers: {
                    "User-Agent": USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get("content-type") ?? "";
            if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
                throw new Error(`Unsupported content type: ${contentType}`);
            }

            const html = await response.text();

            // Parse HTML with linkedom
            const { document } = parseHTML(html);

            // Extract metadata from meta tags
            const metadata = extractMetadata(document);

            // Use Readability to extract article content
            const reader = new Readability(document);
            const article = reader.parse();

            if (article?.textContent) {
                // Log the readability text (LLM summarization deferred for future)
                console.log("=== Readability Content for item", args.itemId, "===");
                console.log("Title:", article.title);
                console.log("Excerpt:", article.excerpt);
                console.log("Text content length:", article.textContent.length);
                console.log("Text preview:", article.textContent.substring(0, 500));
                console.log("=== End Readability Content ===");
            }

            // Use readability title as fallback if metadata didn't have one
            const finalTitle = metadata.title || article?.title || undefined;
            const finalDescription = metadata.description || article?.excerpt || undefined;

            // Update item with metadata
            await ctx.runMutation(internal.modules.items.mutations.updateItemMetadata, {
                itemId: args.itemId,
                title: finalTitle,
                description: finalDescription,
                status: "completed",
            });

            console.log("Successfully fetched metadata for item:", args.itemId);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error("Failed to fetch metadata for item:", args.itemId, errorMessage);

            // Update item with failed status
            await ctx.runMutation(internal.modules.items.mutations.updateItemMetadata, {
                itemId: args.itemId,
                status: "failed",
                statusMessage: errorMessage,
            });
        }
    },
});
