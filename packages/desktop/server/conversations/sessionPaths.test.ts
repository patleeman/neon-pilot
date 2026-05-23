import { describe, expect, it } from 'vitest';

import { resolveSessionsDir, resolveSessionsIndexFile } from './sessionPaths';

describe('sessionPaths', () => {
  it('uses the configured sessions dir when provided', () => {
    expect(resolveSessionsDir({ envSessionsDir: '/tmp/sessions', defaultSessionsDir: '/default/sessions' })).toBe('/tmp/sessions');
    expect(resolveSessionsDir({ defaultSessionsDir: '/default/sessions' })).toBe('/default/sessions');
  });

  it('resolves the session index file precedence', () => {
    expect(
      resolveSessionsIndexFile({
        envSessionsIndexFile: '/custom/index.json',
        envSessionsDir: '/tmp/sessions',
        defaultSessionsIndexFile: '/default/index.json',
      }),
    ).toBe('/custom/index.json');
    expect(resolveSessionsIndexFile({ envSessionsDir: '/tmp/sessions', defaultSessionsIndexFile: '/default/index.json' })).toBe(
      '/tmp/session-meta-index.json',
    );
    expect(resolveSessionsIndexFile({ defaultSessionsIndexFile: '/default/index.json' })).toBe('/default/index.json');
  });
});
