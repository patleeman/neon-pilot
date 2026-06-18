import { describe, expect, it } from 'vitest';

import { resolveWorkflowTools, splitWorkflowTools } from './frontend';

describe('dynamic workflow editor tool drafts', () => {
  it('splits known workflow tools from custom tool names', () => {
    expect(splitWorkflowTools(['read', 'custom-tool', 'bash', 'notify'])).toEqual({
      selectedAllowedTools: ['read', 'bash'],
      additionalAllowedToolsText: 'custom-tool, notify',
    });
  });

  it('resolves selected and custom workflow tools without duplicates', () => {
    expect(
      resolveWorkflowTools({
        selectedAllowedTools: ['read', 'bash'],
        additionalAllowedToolsText: 'bash, custom-tool, read',
      }),
    ).toEqual(['read', 'bash', 'custom-tool']);
  });
});
