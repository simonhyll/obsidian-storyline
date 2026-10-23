import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["*.mjs", "main.js", "dist/**", "node_modules/**"],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      // Preserve brand names with their canonical casing in UI strings.
      "obsidianmd/ui/sentence-case": ["error", {
        brands: ["StoryLine", "Scrivener", "Obsidian"],
      }],
    },
  },
  {
    // Test files use file-level eslint-disable for unsafe rules;
    // some disables may be unused depending on which files are changed.
    files: ["tests/**/*.ts"],
    rules: {
      "eslint-comments/disable-enable-pair": "off",
      "eslint-comments/no-unused-disable": "off",
    },
  },
]);
