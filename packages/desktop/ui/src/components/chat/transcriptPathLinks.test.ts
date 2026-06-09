import { describe, expect, it } from 'vitest';

import {
  detectTranscriptPathCandidates,
  normalizeTranscriptPathTarget,
  readKnowledgeBaseFileIdFromPath,
} from './transcriptPathLinks.js';

describe('transcript path links', () => {
  it('detects workspace-looking file paths and normalizes line suffixes', () => {
    expect(detectTranscriptPathCandidates('Open packages/desktop/ui/src/app/App.tsx:12, then continue.')).toEqual([
      {
        text: 'packages/desktop/ui/src/app/App.tsx:12',
        targetPath: 'packages/desktop/ui/src/app/App.tsx',
      },
    ]);
  });

  it('ignores URLs, prose slashes, and knowledge base repository paths', () => {
    const text =
      'See https://example.test/packages/app.ts and /runtime/knowledge-base/repo/projects/Plan.md before the chat/skip wording.';

    expect(detectTranscriptPathCandidates(text)).toEqual([]);
    expect(readKnowledgeBaseFileIdFromPath('/runtime/knowledge-base/repo/projects/Plan.md')).toBe('projects/Plan.md');
  });

  it('normalizes trailing punctuation without trimming meaningful path text', () => {
    expect(normalizeTranscriptPathTarget('./packages/desktop/ui/src/app/App.tsx).')).toBe('./packages/desktop/ui/src/app/App.tsx');
  });
});
