import esbuild from "esbuild";
import process from "process";
import { mkdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const prod = process.argv[2] === "production";
const __dirname = dirname(fileURLToPath(import.meta.url));

const distDir = resolve(__dirname, "dist");
mkdirSync(distDir, { recursive: true });

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: resolve(distDir, "main.js"),
  minify: prod,
  loader: {
    ".md": "text",
  },
});

// Copy assets to dist/ after each build
function copyAssets() {
  // Copy authoritative manifest from assets/ to dist/
  const manifestSrc = resolve(__dirname, "assets", "manifest.json");
  const manifestContent = readFileSync(manifestSrc, "utf8");
  writeFileSync(resolve(distDir, "manifest.json"), manifestContent);

  // Copy stylesheet from src/styles/ to dist/
  const cssSrc = resolve(__dirname, "src", "styles", "legacy.css");
  const cssContent = readFileSync(cssSrc, "utf8");
  writeFileSync(resolve(distDir, "styles.css"), cssContent);
}

if (prod) {
  await context.rebuild();
  copyAssets();
  process.exit(0);
} else {
  // Watch mode: copy assets initially, then on each rebuild
  copyAssets();
  await context.watch();

  // esbuild watches the TS dependency graph but does not watch the files
  // copied by copyAssets(). Watch their containing directories so atomic
  // editor saves/renames are detected as well as ordinary file edits.
  const sourceAssets = [
    { dir: resolve(__dirname, "assets"), file: "manifest.json" },
    { dir: resolve(__dirname, "src", "styles"), file: "legacy.css" },
  ];
  let copyTimer;
  const scheduleCopy = () => {
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      try {
        copyAssets();
      } catch (error) {
        console.error("[esbuild] Failed to copy changed assets:", error);
      }
    }, 150);
  };
  for (const { dir, file } of sourceAssets) {
    watch(dir, (_event, changedFile) => {
      if (changedFile === null || changedFile.toString() === file) {
        scheduleCopy();
      }
    });
  }
  console.log("[esbuild] Watching TypeScript and source assets for changes...");
  console.log("[esbuild] Output: dist/main.js, dist/manifest.json, dist/styles.css");
}
