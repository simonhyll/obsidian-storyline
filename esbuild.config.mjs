import esbuild from "esbuild";
import process from "process";
import { mkdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as sass from "sass";

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

// Copy manifest and compile SCSS to dist/
function compileScss() {
  // Copy authoritative manifest from assets/ to dist/
  const manifestSrc = resolve(__dirname, "assets", "manifest.json");
  const manifestContent = readFileSync(manifestSrc, "utf8");
  writeFileSync(resolve(distDir, "manifest.json"), manifestContent);

  // Compile SCSS to dist/styles.css
  const result = sass.compile("src/styles/main.scss", {
    style: prod ? "compressed" : "expanded",
    sourceMap: false,
  });
  writeFileSync(resolve(distDir, "styles.css"), result.css);
}

if (prod) {
  await context.rebuild();
  compileScss();
  process.exit(0);
} else {
  // Watch mode: compile SCSS initially, then on each rebuild
  compileScss();
  await context.watch();

  // esbuild watches the TS dependency graph but does not watch SCSS or
  // the manifest. Watch their containing directories so changes trigger
  // a recompilation.
  const sourceAssets = [
    { dir: resolve(__dirname, "assets"), file: "manifest.json" },
    { dir: resolve(__dirname, "src", "styles"), ext: ".scss" },
  ];
  let compileTimer;
  const scheduleCompile = () => {
    clearTimeout(compileTimer);
    compileTimer = setTimeout(() => {
      try {
        compileScss();
      } catch (error) {
        console.error("[esbuild] Failed to compile SCSS:", error);
      }
    }, 150);
  };
  for (const { dir, file, ext } of sourceAssets) {
    watch(dir, (_event, changedFile) => {
      if (changedFile === null) {
        scheduleCompile();
        return;
      }
      const name = changedFile.toString();
      if (file && name === file) {
        scheduleCompile();
      } else if (ext && name.endsWith(ext)) {
        scheduleCompile();
      }
    });
  }
  console.log("[esbuild] Watching TypeScript and source assets for changes...");
  console.log("[esbuild] Output: dist/main.js, dist/manifest.json, dist/styles.css");
}
