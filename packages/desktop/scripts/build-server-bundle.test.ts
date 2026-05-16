import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8');
}

function extractLazyServerModuleSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const regex = /callModuleExport(?:<[^>]+>)?\(\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    specifiers.add(match[1]);
  }
  return [...specifiers].sort();
}

function normalizeLazySpecifier(specifier: string): string {
  return specifier.replace(/^\.\.\/\.\.\//, '').replace(/^\.\.\//, '');
}

describe('desktop server bundle lazy module entries', () => {
  it('packages every relative backend API lazy module used by extension wrappers', () => {
    const backendApiFiles = ['automations.ts', 'gateways.ts', 'knowledgeVault.ts'].map(
      (file) => `packages/desktop/server/extensions/backendApi/${file}`,
    );
    const lazyModuleSpecifiers = backendApiFiles.flatMap((path) => extractLazyServerModuleSpecifiers(readRepoFile(path)));
    const buildScript = readRepoFile('packages/desktop/scripts/build-server-bundle.mjs');

    const missing = lazyModuleSpecifiers.map(normalizeLazySpecifier).filter((distPath) => !buildScript.includes(`['${distPath}',`));

    expect(missing).toEqual([]);
  });
});
