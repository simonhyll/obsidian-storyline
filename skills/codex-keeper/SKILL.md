# Codex Keeper Skill

A skill for analyzing StoryLine project codex entries to find inconsistencies, contradictions, and gaps in worldbuilding content.

## Overview

Codex Keeper scans through a StoryLine project's codex entries — characters, locations, items, lore, and other worldbuilding elements — to identify:

- Contradictions between codex entries (e.g., conflicting character details)
- Inconsistencies between codex entries and scene content
- Missing or incomplete codex entries referenced in scenes
- Naming or terminology inconsistencies across entries

## Structure

```
codex-keeper/
├── src/
│   └── index.ts      # Main entry point
├── package.json       # Package configuration
├── tsconfig.json      # TypeScript configuration
└── SKILL.md           # This file
```

## Usage

```typescript
import { CodexKeeper } from '@obsidian-storyline/codex-keeper';

const keeper = new CodexKeeper();
const result = await keeper.scan(['entry1.md', 'entry2.md']);
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type check
pnpm typecheck
```

## License

MIT
