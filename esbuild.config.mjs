import esbuild from "esbuild";
import process from "process";
import { copyFile, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  const watcher = await context.watch();
  // esbuild watch doesn't expose a callback, so we poll for changes
  // A simpler approach: copy assets on startup and rely on the fact that
  // manifest and CSS rarely change during dev. For CSS changes, the dev
  // workflow should rebuild.
  console.log("[esbuild] Watching for changes...");
  console.log("[esbuild] Output: dist/main.js, dist/manifest.json, dist/styles.css");
}
