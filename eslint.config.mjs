import js from "@eslint/js";
import tseslint from "typescript-eslint";

const tsConfigs = tseslint.configs.recommendedTypeChecked.map((cfg) => ({
  ...cfg,
  files: ["**/*.{ts,tsx}"],
}));

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "apps/**/ios/**",
      "apps/**/android/**",
      "**/.expo/**",
    ],
  },
  js.configs.recommended,
  ...tsConfigs,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/await-thenable": "off",
    },
  },
];