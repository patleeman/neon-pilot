import { describe, expect, it } from 'vitest';

import { buildExtensionToolRegistrations } from './extensionToolContributions';

describe('extensionToolContributions', () => {
  it('builds manifest tool registrations with generated names and defaults', () => {
    expect(
      buildExtensionToolRegistrations({
        extensionId: 'system-browser',
        packageType: 'system',
        tools: [
          {
            id: ' open-url ',
            description: 'Open a URL',
            title: 'Open URL',
            label: 'Open',
            handler: 'openUrl',
            promptSnippet: 'Use for browser navigation.',
            promptGuidelines: ['Prefer active tab.'],
            priority: 10,
            when: { providers: ['openai'], models: ['gpt-*'] },
            nativeRegistration: true,
          },
        ],
      }),
    ).toEqual([
      {
        extensionId: 'system-browser',
        packageType: 'system',
        id: 'open-url',
        name: 'extension_system_browser_open_url',
        action: 'openUrl',
        title: 'Open URL',
        label: 'Open',
        description: 'Open a URL',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        promptSnippet: 'Use for browser navigation.',
        promptGuidelines: ['Prefer active tab.'],
        priority: 10,
        when: { providers: ['openai'], models: ['gpt-*'] },
        nativeRegistration: true,
      },
    ]);
  });

  it('prefers action over handler and replacement names over generated names', () => {
    expect(
      buildExtensionToolRegistrations({
        extensionId: 'diffs',
        tools: [
          {
            id: 'checkpoint',
            description: 'Checkpoint files',
            action: 'checkpoint.apply',
            handler: 'ignored',
            replaces: 'checkpoint',
            inputSchema: { type: 'object', required: ['paths'] },
          },
        ],
      }),
    ).toEqual([
      {
        extensionId: 'diffs',
        packageType: 'user',
        id: 'checkpoint',
        name: 'checkpoint',
        action: 'checkpoint.apply',
        description: 'Checkpoint files',
        inputSchema: { type: 'object', required: ['paths'] },
        replaces: 'checkpoint',
      },
    ]);
  });

  it('skips tools with missing ids, descriptions, or valid names', () => {
    expect(
      buildExtensionToolRegistrations({
        extensionId: '!!!',
        tools: [
          { id: '', description: 'No id' },
          { id: 'no-description', description: '' },
          { id: '!!!', description: 'No valid generated name' },
          { id: 'explicit', description: 'Explicit name', name: 'explicit_tool' },
        ],
      }),
    ).toEqual([
      {
        extensionId: '!!!',
        packageType: 'user',
        id: 'explicit',
        name: 'explicit_tool',
        action: 'explicit',
        description: 'Explicit name',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
    ]);
  });
});
