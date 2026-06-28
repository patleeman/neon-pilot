import { describe, expect, it } from 'vitest';

import { extractMemoryReflection } from './memoryReflectionEngine.js';

describe('memory reflection engine', () => {
  it('classifies preferences, project facts, and skill candidates', () => {
    const result = extractMemoryReflection({
      cwd: '/repo/app',
      displaySummary:
        'The user prefers concise final answers. In this repo, extension runtime code must not import core directly. Repeated workflow: before shipping, run focused tests.',
    });

    expect(result.candidates.map((candidate) => [candidate.kind, candidate.target])).toEqual([
      ['preference', 'system'],
      ['project', 'scope'],
      ['skill', 'skill'],
    ]);
  });

  it('rejects sensitive, transient, and duplicate material', () => {
    const result = extractMemoryReflection({
      displaySummary: 'The user prefers concise final answers. The user pasted API key sk-test-secret-123456. For now, use /tmp/foo.',
      existingMemory: {
        system: 'The user prefers concise final answers.',
      },
    });

    expect(result.candidates).toEqual([]);
    expect(result.rejects.map((reject) => reject.reason)).toContain('duplicate');
    expect(result.rejects.map((reject) => reject.reason)).toContain('sensitive');
    expect(result.rejects.map((reject) => reject.reason)).toContain('transient');
  });
});
