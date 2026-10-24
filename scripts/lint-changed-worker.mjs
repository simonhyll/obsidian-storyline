/**
 * Bounded-memory ESLint worker for changed-line lint.
 *
 * Each process loads only a small, explicit TypeScript project while
 * retaining the repository's full ESLint rule set, including typed rules.
 * The parent starts workers sequentially with a hard heap limit.
 */
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';

const { files, project } = JSON.parse(readFileSync(0, 'utf8'));
if (!Array.isArray(files) || files.length === 0) {
    throw new Error('Lint worker requires at least one file');
}

const options = project ? {
    overrideConfig: [{
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parserOptions: { project } },
    }],
} : {};
const eslint = new ESLint(options);
const results = await eslint.lintFiles(files);

process.stdout.write(JSON.stringify(results.map(result => ({
    filePath: result.filePath,
    errorCount: result.errorCount,
    messages: result.messages.map(message => ({
        line: message.line,
        column: message.column,
        severity: message.severity,
        ruleId: message.ruleId,
        message: message.message,
    })),
}))));
