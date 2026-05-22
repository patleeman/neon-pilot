import { describe, expect, it } from 'vitest';

import { normalizeTranscriptToolName } from './toolNames.js';

describe('toolNames', () => {
  it('normalizes legacy shell tool names to bash and leaves other names unchanged', () => {
    expect(normalizeTranscriptToolName('shell')).toBe('bash');
    expect(normalizeTranscriptToolName('_shell')).toBe('bash');
    expect(normalizeTranscriptToolName('read')).toBe('read');
    expect(normalizeTranscriptToolName('bash')).toBe('bash');
  });
});
