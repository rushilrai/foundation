import Docxtemplater from "docxtemplater";
import expressions from "docxtemplater/expressions.js";
import PizZip from "pizzip";

import type { ResumeData } from "../../../shared/resumeSchema";

export function renderResumeTemplate(
    templateBuffer: ArrayBuffer | Uint8Array,
    data: ResumeData
): Uint8Array {
    const buffer = templateBuffer instanceof Uint8Array
        ? templateBuffer
        : new Uint8Array(templateBuffer);
    const zip = new PizZip(buffer);

    const fileTypeConfig = (Docxtemplater as any).FileTypeConfig.docx();
    fileTypeConfig.getTemplatedFiles = () => ["word/document.xml"];

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        parser: expressions,
        fileTypeConfig
    });

    doc.render(data);

    return doc.getZip().generate({ type: "uint8array" });
}
