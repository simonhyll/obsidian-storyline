import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        deps: {
            inline: ['obsidian'],
        },
    },
    resolve: {
        alias: {
            obsidian: './tests/__mocks__/obsidian.ts',
        },
    },
});
