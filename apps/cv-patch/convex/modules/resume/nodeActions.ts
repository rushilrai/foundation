"use node";

import { internalAction } from "convex/_generated/server";
import { v } from "convex/values";
import { internal } from "convex/_generated/api";
import JSZip from "jszip";

export const extractText = internalAction({
    args: { resumeId: v.id("resumes") },
    handler: async (ctx, args): Promise<void> => {
        try {
            const resume = await ctx.runQuery(internal.modules.resume.queries.getByIdInternal, {
                resumeId: args.resumeId,
            });

            if (!resume) {
                console.error("Resume not found", { resumeId: args.resumeId });
                return;
            }

            const fileBlob = await ctx.storage.get(resume.fileId);
            if (!fileBlob) {
                await ctx.runMutation(internal.modules.resume.mutations.updateExtractedContent, {
                    resumeId: args.resumeId,
                    extractedXml: "",
                    status: "error",
                    errorMessage: "File not found in storage",
                });
                return;
            }

            const arrayBuffer = await fileBlob.arrayBuffer();

            const zip = await JSZip.loadAsync(arrayBuffer);

            const documentXml = await zip.file("word/document.xml")?.async("string");
            if (!documentXml) {
                await ctx.runMutation(internal.modules.resume.mutations.updateExtractedContent, {
                    resumeId: args.resumeId,
                    extractedXml: "",
                    status: "error",
                    errorMessage: "Could not find document.xml in docx file",
                });
                return;
            }

            await ctx.runMutation(internal.modules.resume.mutations.updateExtractedContent, {
                resumeId: args.resumeId,
                extractedXml: documentXml,
                status: "ready",
            });
        } catch (error) {
            console.error("Error extracting text from resume", error);
            await ctx.runMutation(internal.modules.resume.mutations.updateExtractedContent, {
                resumeId: args.resumeId,
                extractedXml: "",
                status: "error",
                errorMessage: error instanceof Error ? error.message : "Unknown error during text extraction",
            });
        }
    },
});
