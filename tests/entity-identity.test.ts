import { describe, it, expect } from 'vitest';
import {
    generateEntityId,
    isValidEntityId,
    generateLegacyIdentity,
    isLegacyIdentity,
    detectDuplicateIdConflicts,
    type EntityIdentity,
} from '../src/models/EntityIdentity';

describe('Entity Identity', () => {
    describe('generateEntityId', () => {
        it('generates valid UUID v4 format', () => {
            const id = generateEntityId();
            expect(isValidEntityId(id)).toBe(true);
        });

        it('generates unique IDs', () => {
            const ids = new Set<string>();
            for (let i = 0; i < 100; i++) {
                ids.add(generateEntityId());
            }
            expect(ids.size).toBe(100);
        });
    });

    describe('isValidEntityId', () => {
        it('accepts valid UUID v4', () => {
            expect(isValidEntityId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        });

        it('rejects invalid format', () => {
            expect(isValidEntityId('not-a-uuid')).toBe(false);
            expect(isValidEntityId('550e8400-e29b-41d4-a716')).toBe(false);
        });

        it('rejects legacy identities', () => {
            expect(isValidEntityId('legacy-1a2b3c4d')).toBe(false);
        });
    });

    describe('generateLegacyIdentity', () => {
        it('produces deterministic output', () => {
            const path = 'Codex/Characters/Alice.md';
            const id1 = generateLegacyIdentity(path);
            const id2 = generateLegacyIdentity(path);
            expect(id1).toBe(id2);
        });

        it('produces different output for different paths', () => {
            const id1 = generateLegacyIdentity('Codex/Characters/Alice.md');
            const id2 = generateLegacyIdentity('Codex/Characters/Bob.md');
            expect(id1).not.toBe(id2);
        });

        it('starts with legacy- prefix', () => {
            const id = generateLegacyIdentity('Some/Path.md');
            expect(id.startsWith('legacy-')).toBe(true);
        });

        it('regression: Codex/Aa.md and Codex/BB.md do not collide', () => {
            // The old 32-bit hash implementation produced collisions for short paths
            // like 'Codex/Aa.md' and 'Codex/BB.md'. This test ensures the new
            // path-based identity never collides.
            const id1 = generateLegacyIdentity('Codex/Aa.md');
            const id2 = generateLegacyIdentity('Codex/BB.md');
            expect(id1).not.toBe(id2);
        });

        it('regression: many short paths produce unique identities', () => {
            // Verify no collisions across a large set of short, similar paths
            const paths = [];
            for (let i = 0; i < 26; i++) {
                for (let j = 0; j < 26; j++) {
                    const letter1 = String.fromCharCode(65 + i);
                    const letter2 = String.fromCharCode(65 + j);
                    paths.push(`Codex/${letter1}${letter2}.md`);
                }
            }
            const ids = new Set(paths.map(generateLegacyIdentity));
            expect(ids.size).toBe(paths.length);
        });

        it('normalizes leading ./ prefix', () => {
            const id1 = generateLegacyIdentity('./Codex/Characters/Alice.md');
            const id2 = generateLegacyIdentity('Codex/Characters/Alice.md');
            expect(id1).toBe(id2);
        });

        it('normalizes double slashes', () => {
            const id1 = generateLegacyIdentity('Codex//Characters//Alice.md');
            const id2 = generateLegacyIdentity('Codex/Characters/Alice.md');
            expect(id1).toBe(id2);
        });

        it('normalizes case for case-insensitive filesystems', () => {
            const id1 = generateLegacyIdentity('Codex/Characters/Alice.md');
            const id2 = generateLegacyIdentity('codex/characters/alice.md');
            expect(id1).toBe(id2);
        });

        it('contains the normalized path', () => {
            const id = generateLegacyIdentity('Scenes/Chapter1.md');
            expect(id).toBe('legacy-scenes/chapter1.md');
        });
    });

    describe('isLegacyIdentity', () => {
        it('identifies legacy identities', () => {
            expect(isLegacyIdentity('legacy-1a2b3c4d')).toBe(true);
        });

        it('rejects real UUIDs', () => {
            expect(isLegacyIdentity('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
        });
    });

    describe('detectDuplicateIdConflicts', () => {
        it('returns empty array for unique IDs', () => {
            const entities: EntityIdentity[] = [
                { id: '11111111-1111-4111-8111-111111111111', type: 'character', filePath: 'A.md' },
                { id: '22222222-2222-4222-8222-222222222222', type: 'character', filePath: 'B.md' },
            ];
            expect(detectDuplicateIdConflicts(entities)).toEqual([]);
        });

        it('detects duplicate UUIDs', () => {
            const entities: EntityIdentity[] = [
                { id: '11111111-1111-4111-8111-111111111111', type: 'character', filePath: 'Universe/Char.md' },
                { id: '11111111-1111-4111-8111-111111111111', type: 'character', filePath: 'Book/Char.md' },
            ];
            const conflicts = detectDuplicateIdConflicts(entities);
            expect(conflicts.length).toBe(1);
            expect(conflicts[0].id).toBe('11111111-1111-4111-8111-111111111111');
        });

        it('ignores legacy identities', () => {
            const entities: EntityIdentity[] = [
                { id: 'legacy-1a2b3c4d', type: 'character', filePath: 'A.md' },
                { id: 'legacy-1a2b3c4d', type: 'character', filePath: 'B.md' },
            ];
            expect(detectDuplicateIdConflicts(entities)).toEqual([]);
        });

        it('ignores entities without IDs', () => {
            const entities: EntityIdentity[] = [
                { type: 'character', filePath: 'A.md' },
                { type: 'character', filePath: 'B.md' },
            ];
            expect(detectDuplicateIdConflicts(entities)).toEqual([]);
        });
    });
});
