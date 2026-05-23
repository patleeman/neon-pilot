import { describe, expect, it } from 'vitest';

import { buildExtensionToolRegistrationName, normalizeToolNamePart } from './extensionToolNames';

describe('extensionToolNames', () => {
  it('normalizes extension and tool id parts for generated tool names', () => {
    expect(normalizeToolNamePart(' System Browser / Open URL! ')).toBe('system_browser_open_url');
    expect(normalizeToolNamePart('___')).toBe('');
  });

  it('prefers replacement and explicit names before generated names', () => {
    expect(
      buildExtensionToolRegistrationName({
        extensionId: 'system-browser',
        toolId: 'open-url',
        explicitName: 'custom_open',
        replaces: 'browser.open',
      }),
    ).toBe('browser.open');
    expect(buildExtensionToolRegistrationName({ extensionId: 'system-browser', toolId: 'open-url', explicitName: 'custom_open' })).toBe(
      'custom_open',
    );
    expect(buildExtensionToolRegistrationName({ extensionId: 'system-browser', toolId: 'open-url' })).toBe(
      'extension_system_browser_open_url',
    );
  });

  it('returns null when a generated name has no valid parts', () => {
    expect(buildExtensionToolRegistrationName({ extensionId: '!!!', toolId: 'open-url' })).toBeNull();
    expect(buildExtensionToolRegistrationName({ extensionId: 'system-browser', toolId: '!!!' })).toBeNull();
  });
});
