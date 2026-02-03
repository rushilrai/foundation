"use node";

import { readFile } from "node:fs/promises";

import { openai, OpenAIModels, setupOpenAI } from "@convex/configs/ai";
import { generateText, Output } from "ai";
import { internal } from "convex/_generated/api";
import { internalAction } from "convex/_generated/server";
import { v } from "convex/values";
import { z } from "zod";

import { renderResumeTemplate } from "./docxTemplate";
import { ResumeDataSchema, type ResumeData } from "../../../shared/resumeSchema";

const patchOutputSchema = z.object({
    data: ResumeDataSchema,
    changes: z.array(z.string()),
});

export const generatePatch = internalAction({
    args: { patchId: v.id("patches") },
    handler: async (ctx, args): Promise<void> => {
        console.log("[generatePatch] Starting", { patchId: args.patchId });

        try {
            await setupOpenAI();

            const patch = await ctx.runQuery(internal.modules.patch.queries.getByIdInternal, {
                patchId: args.patchId,
            });

            if (!patch) {
                console.error("[generatePatch] Patch not found", { patchId: args.patchId });
                return;
            }

            const resume = await ctx.runQuery(internal.modules.resume.queries.getByIdInternal, {
                resumeId: patch.resumeId,
            });

            if (!resume) {
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    data: null,
                    changes: null,
                    status: "error",
                    errorMessage: "Resume not found",
                });
                return;
            }

            if (!resume.data) {
                await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                    patchId: args.patchId,
                    patchedFileId: null,
                    data: null,
                    changes: null,
                    status: "error",
                    errorMessage: "Resume data not available",
                });
                return;
            }

            await ctx.runMutation(internal.modules.patch.mutations.updateStreamingText, {
                patchId: args.patchId,
                streamingText: "Analyzing resume and job description...",
            });

            const system = `You are an expert resume editor and ATS optimizer.

Task: Tailor the resume to the job description while preserving factual accuracy and structure.

Rules:
1. Do NOT invent facts. Only rewrite or re-emphasize what is already present.
2. Preserve the overall structure and ordering of sections.
3. Keep names, contact info, and education intact unless the job description requires minor phrasing updates.
4. Improve bullet clarity and keyword alignment with the job description.
5. Output JSON that strictly matches the schema.`;

            const prompt = `Base resume JSON:
${JSON.stringify(resume.data, null, 2)}

Job description:
${patch.jobDescription}

${patch.companyName ? `Company: ${patch.companyName}` : ""}
${patch.roleName ? `Role: ${patch.roleName}` : ""}

Return JSON with:
- data: the updated ResumeData JSON
- changes: short bullet list of what you changed`;

            const { output } = await generateText({
                model: openai.responses(OpenAIModels["gpt-5.2"]),
                output: Output.object({ schema: patchOutputSchema }),
                system,
                prompt,
            });

            if (!output) {
                throw new Error("LLM did not return output");
            }

            let data = output.data as ResumeData;
            let changes = output.changes ?? [];

            const issues = validatePatchedData(data, resume.data);
            if (issues.length > 0) {
                await ctx.runMutation(internal.modules.patch.mutations.updateStreamingText, {
                    patchId: args.patchId,
                    streamingText: "QA detected issues. Refining output...",
                });

                const { output: retryOutput } = await generateText({
                    model: openai.responses(OpenAIModels["gpt-5.2"]),
                    output: Output.object({ schema: patchOutputSchema }),
                    system,
                    prompt: `${prompt}\n\nFix these issues:\n${issues.join("\n")}`,
                });

                if (retryOutput) {
                    data = retryOutput.data as ResumeData;
                    changes = mergeChanges(changes, retryOutput.changes);
                }
            }

            const finalIssues = validatePatchedData(data, resume.data);
            if (finalIssues.length > 0) {
                throw new Error(`Patched resume failed validation: ${finalIssues.join("; ")}`);
            }

            const templateBuffer = await getTemplateBuffer();
            const docxBytes = renderResumeTemplate(templateBuffer, data);
            const docxBuffer = toArrayBuffer(docxBytes);

            const patchedFileId = await ctx.storage.store(
                new Blob([docxBuffer], {
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                })
            );

            await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                patchId: args.patchId,
                patchedFileId,
                data,
                changes,
                status: "ready",
                errorMessage: undefined,
            });

            console.log("[generatePatch] Complete", { patchId: args.patchId });
        } catch (error) {
            console.error("[generatePatch] Error", error);

            await ctx.runMutation(internal.modules.patch.mutations.updateGeneratedContent, {
                patchId: args.patchId,
                patchedFileId: null,
                data: null,
                changes: null,
                status: "error",
                errorMessage: error instanceof Error ? error.message : "Unknown error during patch generation",
            });
        }
    },
});

let cachedTemplate: Uint8Array | null = null;

async function getTemplateBuffer(): Promise<Uint8Array> {
    if (cachedTemplate) {
        return cachedTemplate;
    }

    const templateUrl = new URL("../../assets/resume-template.docx", import.meta.url);
    const buffer = await readFile(templateUrl);
    cachedTemplate = new Uint8Array(buffer);
    return cachedTemplate;
}

function validatePatchedData(data: ResumeData, base: ResumeData): string[] {
    const issues: string[] = [];
    if (!data.header.name.trim()) issues.push("header.name is empty");
    if (!data.header.email.trim()) issues.push("header.email is empty");
    if (!data.header.phone.trim()) issues.push("header.phone is empty");
    if (!data.header.linkedin.trim()) issues.push("header.linkedin is empty");
    if (base.education.length > 0 && data.education.length === 0) {
        issues.push("education section was removed");
    }
    if (base.experience.length > 0 && data.experience.length === 0) {
        issues.push("experience section was removed");
    }
    if (base.projects.length > 0 && data.projects.length === 0) {
        issues.push("projects section was removed");
    }
    return issues;
}

function mergeChanges(primary?: string[], secondary?: string[]): string[] {
    const merged = new Set<string>();
    for (const change of primary ?? []) {
        merged.add(change);
    }
    for (const change of secondary ?? []) {
        merged.add(change);
    }
    return Array.from(merged);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}
