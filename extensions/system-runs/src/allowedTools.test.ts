import { describe, expect, it } from 'vitest';

import { ALLOWED_TOOLS_DESCRIPTION, COMMON_AGENT_TOOL_NAMES, normalizeAllowedTools } from './allowedTools.js';

describe('allowed tools normalization', () => {
  it('documents common agent tool names and shell command guidance', () => {
    expect(COMMON_AGENT_TOOL_NAMES).toContain('bash');
    expect(COMMON_AGENT_TOOL_NAMES).toContain('subagent');
    expect(ALLOWED_TOOLS_DESCRIPTION).toContain('Shell commands like rg/grep/find/ls are not tool names');
  });

  it('normalizes undefined, arrays, and comma-separated strings', () => {
    expect(normalizeAllowedTools(undefined)).toBeUndefined();
    expect(normalizeAllowedTools(null)).toBeUndefined();
    expect(normalizeAllowedTools(' bash, read ,, write ')).toEqual(['bash', 'read', 'write']);
    expect(normalizeAllowedTools([' bash ', 'read', '', 123])).toEqual(['bash', 'read', '123']);
    expect(normalizeAllowedTools(' , , ')).toBeUndefined();
  });

  it('rejects shell command names with actionable hints', () => {
    for (const command of ['rg', 'grep', 'find', 'ls', 'cat', 'sed']) {
      expect(() => normalizeAllowedTools([command])).toThrow(`allowedTools contains shell command "${command}"`);
      expect(() => normalizeAllowedTools([command])).toThrow('allowedTools only accepts agent tool names');
    }
  });
});
