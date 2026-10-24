# Critiquer Skill

A skill for evaluating how well a book resonates with its intended target audience based on configurable audience settings.

## Overview

Critiquer reads a book's content and analyzes it against defined audience parameters to assess:

- Tone and style alignment with the target demographic
- Pacing and complexity appropriateness for the audience
- Theme resonance and relatability factors
- Language accessibility and readability for the intended readers
- Overall "vibe" score indicating how well the book will connect with its audience

## Structure

```
critiquer/
├── src/
│   └── index.ts      # Main entry point
├── package.json       # Package configuration
├── tsconfig.json      # TypeScript configuration
└── SKILL.md           # This file
```

## Usage

```typescript
import { Critiquer } from '@obsidian-storyline/critiquer';

const critiquer = new Critiquer();
const report = await critiquer.evaluate(bookContent, {
  targetAudience: 'young-adult',
  genre: 'fantasy',
  tone: 'lighthearted',
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
