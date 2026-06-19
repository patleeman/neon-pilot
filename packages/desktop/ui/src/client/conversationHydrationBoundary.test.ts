import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const uiSrcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === 'coverage') {
      return [];
    }
    if (statSync(path).isDirectory()) {
      return collectSourceFiles(path);
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) {
      return [];
    }
    return [path];
  });
}

describe('conversation hydration boundary', () => {
  it('keeps legacy open-tabs and recovery details out of production UI callers', () => {
    const violations = collectSourceFiles(uiSrcRoot).flatMap((path) => {
      const rel = relative(uiSrcRoot, path);
      const source = readFileSync(path, 'utf8');
      const fileViolations: string[] = [];

      if (/\bopenConversationTabs\b/.test(source)) {
        fileViolations.push(`${rel}: openConversationTabs`);
      }
      if (/\bsetOpenConversationTabs\b/.test(source)) {
        fileViolations.push(`${rel}: setOpenConversationTabs`);
      }
      if (rel !== 'client/api.ts' && /\/recover\b/.test(source)) {
        fileViolations.push(`${rel}: /recover`);
      }

      return fileViolations;
    });

    expect(violations).toEqual([]);
  });
});
