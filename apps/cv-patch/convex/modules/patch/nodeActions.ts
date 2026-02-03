"use node";

import { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import { openai, OpenAIModels, setupOpenAI } from "@convex/configs/ai";
import { streamText, Output } from "ai";
import { internal } from "convex/_generated/api";
import { internalAction } from "convex/_generated/server";
import { v } from "convex/values";
import JSZip from "jszip";
import { z } from "zod";

const patchOutputSchema = z.object({
    changes: z.array(z.string()),
    edits: z.array(
        z.object({
            id: z.number().int().nonnegative(),
            text: z.string(),
        })
    ),
});

export const generatePatch = internalAction({
    args: { patchId: v.id("patches") },
    handler: async (ctx, args): Promise<void> => {
        console.log("[generatePatch] Starting", { patchId: args.patchId });

        let streamError: Error | null = null;

        try {
            await setupOpenAI();
            console.log("[generatePatch] OpenAI setup complete");

            const patch = await ctx.runQuery(internal.modules.patch.queries.getByIdInternal, {
                patchId: args.patchId,
            });
            console.log("[generatePatch] Got patch", { found: !!patch });

            if (!patch) {
                console.error("[generatePatch] Patch not found", { patchId: args.patchId });
                return;
            }

            const resume = await ctx.runQuery(internal.modules.resume.queries.getByIdInternal, {
                resumeId: patch.resumeId,
            });
            console.log("[generatePatch] Got resume", { found: !!resume, hasXml: !!resume?.extractedXml });

            if (!resume) {
                console.log("[generatePatch] Resume not found, updating status to error");
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    changes: null,
                    status: "error",
                    errorMessage: "Resume not found",
                });
                return;
            }

            if (!resume.extractedXml) {
                console.log("[generatePatch] No extractedXml, updating status to error");
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    changes: null,
                    status: "error",
                    errorMessage: "Resume XML not extracted",
                });
                return;
            }

            const { nodes: textNodes, parts: xmlParts } = extractTextNodes(resume.extractedXml);
            console.log("[generatePatch] Extracted text nodes", { count: textNodes.length });

            if (textNodes.length === 0) {
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    changes: null,
                    status: "error",
                    errorMessage: "No text nodes found in resume XML",
                });
                return;
            }

            console.log("[generatePatch] Starting LLM stream...");

            const { partialOutputStream } = streamText({
                model: openai.responses(OpenAIModels["gpt-5.2"]),
                providerOptions: {
                    openai: {
                        reasoningEffort: "none"
                    } satisfies OpenAIResponsesProviderOptions
                },
                output: Output.object({ schema: patchOutputSchema }),
                onError({ error }) {
                    console.error("[generatePatch] Stream error", error);
                    streamError = error instanceof Error ? error : new Error(String(error));
                },
                system: `You are an expert resume writer. Your task is to tailor a resume for a specific job description.

You will receive ONLY the text nodes from a Word document (the contents of <w:t> tags), each with an id.

CRITICAL RULES:
1. ONLY propose edits to text content for existing ids. Do NOT add or remove ids.
2. Do NOT invent facts. Preserve factual accuracy.
3. Keep formatting intact by editing as few nodes as possible.
4. Do NOT include unchanged nodes in the edits list.
5. If a change needs more words, add them into the nearest relevant node(s).
6. In the "changes" array, list each modification you made as a brief description (e.g., "Added 'Python' keyword to skills section").
7. Return JSON that matches the schema: { changes: string[], edits: { id: number, text: string }[] }`,
                prompt: `Resume text nodes (id -> text):
${JSON.stringify(textNodes.map(node => ({ id: node.id, text: node.text })))}

---

Job Description:
${patch.jobDescription}

${patch.companyName ? `Company: ${patch.companyName}` : ""}
${patch.roleName ? `Role: ${patch.roleName}` : ""}

Tailor the resume by proposing edits to ONLY the text nodes above.`,
            });

            const UPDATE_INTERVAL_MS = 500;
            let lastUpdateTime = Date.now();
            let finalOutput: z.infer<typeof patchOutputSchema> | undefined;

            for await (const partialObject of partialOutputStream) {
                finalOutput = partialObject as z.infer<typeof patchOutputSchema>;

                const now = Date.now();
                if (now - lastUpdateTime >= UPDATE_INTERVAL_MS) {
                    let streamingText = "";

                    if (partialObject.changes?.length) {
                        streamingText += `Changes identified:\n${partialObject.changes.map(c => `• ${c}`).join('\n')}`;
                    }

                    if (partialObject.edits?.length) {
                        streamingText += `\n\nEdits drafted: ${partialObject.edits.length}`;
                    } else if (!partialObject.changes?.length) {
                        streamingText = "Analyzing resume...";
                    }

                    await ctx.runMutation(internal.modules.patch.mutations.updateStreamingText, {
                        patchId: args.patchId,
                        streamingText,
                    });
                    lastUpdateTime = now;
                }
            }

            if (streamError) {
                throw streamError;
            }

            if (!finalOutput) {
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    changes: null,
                    status: "error",
                    errorMessage: "LLM did not return output",
                });

                return;
            }

            const { edits, changes } = finalOutput;
            const patchedXml = applyEditsToXml({ nodes: textNodes, parts: xmlParts }, edits);
            console.log("[generatePatch] Stream complete", {
                editsCount: edits?.length,
                changesCount: changes?.length,
                xmlLength: patchedXml.length,
            });

            const fileBlob = await ctx.storage.get(resume.fileId);
            console.log("[generatePatch] Got file blob", { found: !!fileBlob });

            if (!fileBlob) {
                console.log("[generatePatch] File blob not found, updating status to error");
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    changes: null,
                    status: "error",
                    errorMessage: "Original resume file not found",
                });
                return;
            }

            console.log("[generatePatch] Generating patched docx...");
            const patchedDocx = await generatePatchedDocx(
                await fileBlob.arrayBuffer(),
                patchedXml
            );
            console.log("[generatePatch] Patched docx generated", { size: patchedDocx.byteLength });

            console.log("[generatePatch] Storing patched docx...");
            const patchedFileId = await ctx.storage.store(
                new Blob([patchedDocx], {
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                })
            );
            console.log("[generatePatch] Stored patched docx", { patchedFileId });

            console.log("[generatePatch] Updating patch record...");
            await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                patchId: args.patchId,
                patchedFileId,
                changes,
                status: "ready",
            });
            console.log("[generatePatch] Complete!");
        } catch (error) {
            console.error("[generatePatch] Error", error);

            await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                patchId: args.patchId,
                patchedFileId: null,
                changes: null,
                status: "error",
                errorMessage: error instanceof Error ? error.message : "Unknown error during patch generation",
            });
        }
    },
});

async function generatePatchedDocx(
    originalDocx: ArrayBuffer,
    patchedXml: string
): Promise<ArrayBuffer> {
    const zip = await JSZip.loadAsync(originalDocx);

    zip.file("word/document.xml", patchedXml);

    return await zip.generateAsync({ type: "arraybuffer" });
}

type TextNode = {
    id: number;
    openTag: string;
    closeTag: string;
    rawText: string;
    text: string;
};

type ExtractedTextNodes = {
    nodes: TextNode[];
    parts: Array<string | number>;
};

function extractTextNodes(xml: string): ExtractedTextNodes {
    const nodes: TextNode[] = [];
    const parts: Array<string | number> = [];
    const textNodeRegex = /<w:t\b[^>]*>[\s\S]*?<\/w:t>/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = textNodeRegex.exec(xml)) !== null) {
        const full = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + full.length;
        const openTagEnd = full.indexOf(">");

        if (openTagEnd === -1) {
            continue;
        }

        const openTag = full.slice(0, openTagEnd + 1);
        const closeTag = "</w:t>";
        const rawText = full.slice(openTagEnd + 1, full.length - closeTag.length);

        parts.push(xml.slice(lastIndex, startIndex));

        const id = nodes.length;
        nodes.push({
            id,
            openTag,
            closeTag,
            rawText,
            text: decodeXml(rawText),
        });
        parts.push(id);
        lastIndex = endIndex;
    }

    parts.push(xml.slice(lastIndex));

    return { nodes, parts };
}

function applyEditsToXml(
    extracted: ExtractedTextNodes,
    edits: Array<{ id: number; text: string }>
): string {
    const editsById = new Map<number, string>();
    for (const edit of edits ?? []) {
        if (Number.isInteger(edit.id) && edit.id >= 0 && edit.id < extracted.nodes.length) {
            editsById.set(edit.id, edit.text);
        }
    }

    return extracted.parts
        .map(part => {
            if (typeof part === "number") {
                const node = extracted.nodes[part];
                const updatedText = editsById.has(part)
                    ? encodeXml(editsById.get(part) ?? "")
                    : node.rawText;
                return `${node.openTag}${updatedText}${node.closeTag}`;
            }
            return part;
        })
        .join("");
}

function decodeXml(text: string): string {
    return text
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
            String.fromCodePoint(parseInt(hex, 16))
        )
        .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

function encodeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
