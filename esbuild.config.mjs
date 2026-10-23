import esbuild from "esbuild";
import process from "process";
import { mkdirSync, readFileSync, readdirSync, watch, writeFileSync } from "node:fs";
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
  const result = sass.compile(resolve(__dirname, "assets", "scss", "main.scss"), {
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

  // Sass imports nested partials, but esbuild only watches TypeScript.
  // Watch EVERY SCSS directory individually: recursive fs.watch() is not
  // supported consistently on Linux/macOS/Windows. Refresh the directory
  // watchers when modules or directories are added or removed.
  const scssRoot = resolve(__dirname, "assets", "scss");
  const scssWatchers = new Map();
  function watchScssDirectories(dir) {
    if (!scssWatchers.has(dir)) {
      scssWatchers.set(dir, watch(dir, (_event, filename) => {
        if (filename === null || filename.toString().endsWith(".scss")) {
          scheduleCompile();
        } else {
          // A newly created/renamed nested folder must be watched too.
          scheduleCompile();
        }
      }));
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        watchScssDirectories(resolve(dir, entry.name));
      }
    }
  }
  let compileTimer;
  const scheduleCompile = () => {
    clearTimeout(compileTimer);
    compileTimer = setTimeout(() => {
      try {
        // Re-discover directories before compiling so new modules are watched.
        watchScssDirectories(scssRoot);
        compileScss();
      } catch (error) {
        console.error("[esbuild] Failed to compile SCSS:", error);
      }
    }, 150);
  };
  watchScssDirectories(scssRoot);
  watch(resolve(__dirname, "assets"), (_event, filename) => {
    if (filename === null || filename.toString() === "manifest.json") {
      scheduleCompile();
    }
  });
  console.log("[esbuild] Watching TypeScript and source assets for changes...");
  console.log("[esbuild] Output: dist/main.js, dist/manifest.json, dist/styles.css");
}
