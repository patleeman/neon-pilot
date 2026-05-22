import { describe, expect, it } from 'vitest';

import { ALLOWED_TOOLS_DESCRIPTION, COMMON_AGENT_TOOL_NAMES, normalizeAllowedTools } from './allowedTools.js';

describe('allowedTools metadata', () => {
  it('returns undefined for nullish or blank allowedTools values', () => {
    expect(normalizeAllowedTools(undefined)).toBeUndefined();
    expect(normalizeAllowedTools(null)).toBeUndefined();
    expect(normalizeAllowedTools(' , \n ')).toBeUndefined();
    expect(normalizeAllowedTools([])).toBeUndefined();
  });

  it('stringifies non-string array entries before trimming', () => {
    expect(normalizeAllowedTools(['bash', 123, false])).toEqual(['bash', '123', 'false']);
  });

  it('documents common agent tools and shell-command guidance', () => {
    expect(COMMON_AGENT_TOOL_NAMES).toContain('background_bash');
    expect(COMMON_AGENT_TOOL_NAMES).toContain('subagent');
    expect(ALLOWED_TOOLS_DESCRIPTION).toContain('actual agent tool names');
    expect(ALLOWED_TOOLS_DESCRIPTION).toContain('Shell commands like rg/grep/find/ls are not tool names');
  });

  it('rejects common shell command names with command-specific hints', () => {
    for (const command of ['find', 'ls', 'cat', 'sed']) {
      expect(() => normalizeAllowedTools([command])).toThrow(`allowedTools contains shell command "${command}"`);
    }
  });
});
