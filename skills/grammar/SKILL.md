# Grammar Skill

A modular grammar checking and correction skill for Obsidian StoryLine. This skill provides utilities for analyzing and improving the grammar, style, and clarity of written content within StoryLine documents.

## Overview

The grammar skill is designed to be packaged as a standalone product that integrates with the Obsidian StoryLine plugin. It offers:

- Grammar rule checking for prose and narrative text
- Style suggestions for writing consistency
- Correction recommendations with explanations

## Structure

```
grammar/
├── src/
│   └── index.ts      # Main entry point
├── package.json       # Package configuration
├── tsconfig.json      # TypeScript configuration
└── SKILL.md           # This file
```

## Usage

```typescript
import { GrammarChecker } from '@obsidian-storyline/grammar';

const checker = new GrammarChecker();
const result = await checker.check('Your text here');
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
