# StoryLine development / Starforge integration

StoryLine source: https://github.com/simonhyll/obsidian-storyline
Starforge writing vault: https://github.com/simonhyll/author-starforge

Keep plugin **source** in this repository, separate from the Obsidian **vault**. The manifest ID is **storyline**; do not change the ID just because the plugin is forked. That would cause Obsidian to treat it as a separate plugin.

## Local prerequisites

Obsidian Desktop, Git, Node.js 22 and npm. Clone both repositories side by side.

**Never test new plugin code against your only copy of a writing vault.** Obsidian plugins may modify vault files. Use an isolated testing vault, preferably a local test clone of Starforge:

    git clone https://github.com/simonhyll/author-starforge.git ../author-starforge-dev

Open the testing vault folder in Obsidian at least once to initialize it. Do not push test edits back to author-starforge.

## Initial build and installation

Run from the obsidian-storyline source checkout:

    npm ci
    npm run build
    npm run vault:install -- "/absolute/path/to/author-starforge-dev"

On Windows, supply a Windows directory path (for example: C:\Users\you\author-starforge-dev).

In the test vault, enable Community plugins and StoryLine, if not already enabled.

## Develop with automatic local deployment

Run these two commands in **separate terminals**, both inside the obsidian-storyline checkout.

Terminal A (TypeScript -> built JavaScript):

    npm run dev

Terminal B (build assets -> the **test** Obsidian vault):

    npm run vault:watch -- "/absolute/path/to/author-starforge-dev"

The sync command watches main.js, manifest.json and styles.css and copies changed files to the test vault's .obsidian/plugins/storyline/ directory. The plugin must still reload in Obsidian to pick up JavaScript changes. The optional Hot-Reload community plugin can do this automatically in your *testing* vault. If the manifest changes, a full Obsidian restart may be necessary.

Ctrl+C stops each watcher.

## Install a tested version in the real Starforge vault

After testing, stop the watchers, build a production bundle and explicitly install it:

    npm ci
    npm run build
    npm run vault:install -- "/absolute/path/to/author-starforge"

This updates **only** main.js, manifest.json and styles.css in the existing storyline plugin folder. It leaves all writing files, Obsidian settings and StoryLine data.json untouched.

**Repository note:** author-starforge already commits these installed plugin assets to Git. Syncing into that repository will mark those files as modified; review and commit the update there **separately** when you want to version the installed build. Do not point the live development watcher at your main writing vault.

## CI and release process

- The new .github/workflows/ci.yml builds code on pull requests and main pushes, validates manifest/package/lockfile versions, checks assets and script syntax, and uploads an installable build artifact.
- The inherited manually dispatched .github/workflows/release.yml is not changed by this setup. An ordinary CI build does not publish a GitHub release.
- The inherited release process commits generated main.js, which is tracked in Git. Local builds can modify this file; review changes before committing.
- Type checking and lint are **not yet added as blocking CI gates** until the large upstream baseline has been assessed and cleaned up.

With the pipeline in place, implement and review future Starforge-specific changes here, then test them in the isolated vault before installing them in real Starforge.
