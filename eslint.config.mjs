import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  // ---------------------------------------------------------------------------
  // TypeScript source files (Obsidian plugin code)
  // ---------------------------------------------------------------------------
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
    // Test files: keep structural budgets, re-enable safety rules.
    // Narrow exceptions are handled per-file when truly unavoidable.
    files: ["tests/**/*.ts"],
    rules: {
      "eslint-comments/disable-enable-pair": "off",
      "eslint-comments/no-unused-disable": "off",
    },
  },
  // ---------------------------------------------------------------------------
  // Hand-authored JavaScript scripts (build, CI, vault sync, etc.)
  // These are Node.js scripts, not Obsidian plugin code, so Obsidian-specific
  // rules are disabled. We still enforce structural budgets.
  // ---------------------------------------------------------------------------
  {
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // Structural budgets apply to scripts as well.
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "complexity": ["error", { max: 10 }],
      "max-depth": ["error", { max: 3 }],
      "max-statements": ["error", { max: 25 }],
      "max-params": ["error", { max: 4 }],
      // Node.js scripts legitimately use Node.js APIs and process globals.
      "obsidianmd/no-nodejs-modules": "off",
      "no-undef": "off",
      // Console logging is expected in CLI scripts.
      "obsidianmd/rule-custom-message": "off",
      // Scripts may use require() in CJS context.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
