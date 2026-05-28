import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const releaseSmokeArgs = ['--max-conversation-content-open-phase-ms=1500', '--max-conversation-extension-open-phase-ms=1500'];

describe('release smoke perf budgets', () => {
  it('uses explicit packaged-app conversation-open phase budgets when publishing', () => {
    const source = readFileSync(new URL('./publish-desktop-release.mjs', import.meta.url), 'utf8');

    for (const arg of releaseSmokeArgs) {
      expect(source).toContain(arg);
    }
  });

  it('keeps local release verification aligned with publish smoke budgets', () => {
    const source = readFileSync(new URL('./verify-desktop-release-build.mjs', import.meta.url), 'utf8');

    for (const arg of releaseSmokeArgs) {
      expect(source).toContain(arg);
    }
  });
});
