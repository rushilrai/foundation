import fs from "node:fs";
import path from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import expressions from "docxtemplater/expressions.js";

const templatePath = path.resolve(process.cwd(), "convex/assets/resume-template.docx");
const dataPath = path.resolve(process.cwd(), "scripts/sample-data.json");
const outputPath = path.resolve(process.cwd(), "scripts/rendered-sample.docx");

const content = fs.readFileSync(templatePath, "binary");
const zip = new PizZip(content);
const fileTypeConfig = Docxtemplater.FileTypeConfig.docx();
fileTypeConfig.getTemplatedFiles = () => ["word/document.xml"];

const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: expressions,
    fileTypeConfig,
});

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

doc.render(data);

const buffer = doc.getZip().generate({ type: "nodebuffer" });
fs.writeFileSync(outputPath, buffer);

console.log(`Rendered template -> ${outputPath}`);
