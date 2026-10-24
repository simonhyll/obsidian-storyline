# Storyliner Skill

A skill for scaffolding new StoryLine projects with templates and beat sheets based on a high-level project description.

## Overview

Storyliner takes a basic description of a story project and generates a complete StoryLine project structure, including:

- Project folder layout with StoryLine conventions
- Scene templates organized by act or chapter
- Beat sheets based on common narrative structures (e.g., Save the Cat, Hero's Journey)
- Character and location codex entry templates
- Metadata files for project configuration

## Structure

```
storyliner/
├── src/
│   └── index.ts      # Main entry point
├── package.json       # Package configuration
├── tsconfig.json      # TypeScript configuration
└── SKILL.md           # This file
```

## Usage

```typescript
import { Storyliner } from '@obsidian-storyline/storyliner';

const storyliner = new Storyliner();
const project = await storyliner.scaffold({
  title: 'My Novel',
  genre: 'Fantasy',
  structure: 'save-the-cat',
});
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
