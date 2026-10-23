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
      // The inherited preset enabled the destructive any -> unknown fixer.
      // Keep the warning/error, but NEVER change types automatically.
      "@typescript-eslint/no-explicit-any": ["error", { fixToUnknown: false }],

      // Structural budgets: count executable code, not blank/comment-only lines.
      // Legacy violations will be refactored in bounded module groups.
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "complexity": ["error", { max: 10 }],
      "max-depth": ["error", { max: 3 }],
      "max-statements": ["error", { max: 25 }],
      "max-params": ["error", { max: 4 }],
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
