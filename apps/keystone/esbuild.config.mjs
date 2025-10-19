import { build } from "esbuild";

await build({
    entryPoints: ["src/app.ts"],
    outfile: "dist/app.cjs",
    platform: "node",
    format: "cjs",
    target: "node22",
    bundle: true,
    sourcemap: true,
    legalComments: "none",
    logLevel: "info"
});