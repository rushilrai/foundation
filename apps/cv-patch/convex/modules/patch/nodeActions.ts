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
    patchedXml: z.string(),
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

            console.log("[generatePatch] Starting LLM stream...");

            const { partialOutputStream } = streamText({
                model: openai.responses(OpenAIModels["gpt-5.2"]),
                providerOptions: {
                    openai: {
                        reasoningEffort: "none"
                    } satisfies OpenAIResponsesProviderOptions
                },
                output: Output.object({
                    schema: patchOutputSchema,
                }),
                onError({ error }) {
                    console.error("[generatePatch] Stream error", error);
                    streamError = error instanceof Error ? error : new Error(String(error));
                },
                system: `You are an expert resume writer. Your task is to tailor a resume for a specific job description.

You will receive the resume as Word document XML (document.xml from a .docx file).

CRITICAL RULES:
1. ONLY modify text content inside <w:t> tags - these contain the visible text
2. DO NOT modify, add, or remove any XML tags or attributes
3. DO NOT change any formatting tags (<w:rPr>, <w:pPr>, <w:r>, etc.)
4. DO NOT add or remove paragraphs (<w:p> elements)
5. Keep all factual information accurate - do not fabricate experience or skills
6. Reorder emphasis and use keywords from the job description where they genuinely apply
7. In the "changes" array, list each modification you made as a brief description (e.g., "Added 'Python' keyword to skills section", "Reworded project description to emphasize leadership")
8. Return the changes array FIRST, then the patchedXml`,
                prompt: `Resume XML:
${resume.extractedXml}

---

Job Description:
${patch.jobDescription}

${patch.companyName ? `Company: ${patch.companyName}` : ""}
${patch.roleName ? `Role: ${patch.roleName}` : ""}

Tailor the resume for this job by modifying ONLY the text inside <w:t> tags.`,
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

                    if (partialObject.patchedXml) {
                        streamingText += `\n\n🍳 Cooking resume...\n\n${partialObject.patchedXml}`;
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

            if (!finalOutput?.patchedXml) {
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    changes: finalOutput?.changes || null,
                    status: "error",
                    errorMessage: "LLM did not return patchedXml",
                });

                return;
            }

            const { patchedXml, changes } = finalOutput;
            console.log("[generatePatch] Stream complete", {
                xmlLength: patchedXml?.length,
                changesCount: changes?.length
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
