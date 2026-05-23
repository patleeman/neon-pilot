import { describe, expect, it } from 'vitest';

import { validateExtensionBackendContribution } from './extensionBackendValidation';

describe('extensionBackendValidation', () => {
  it('validates backend contribution groups', () => {
    expect(
      validateExtensionBackendContribution({
        entry: './backend.js',
        services: [{ id: 'svc', handler: 'serve', restart: 'on-failure' }],
        actions: [{ id: 'act', handler: 'run' }],
        protocolEntrypoints: [{ id: 'proto', handler: 'handle' }],
        routes: [{ method: 'POST', path: '/api/run', handler: 'route' }],
      }),
    ).toBeUndefined();
  });

  it('preserves validation errors', () => {
    expect(() => validateExtensionBackendContribution({})).toThrow('Extension manifest backend.entry must be a non-empty string.');
    expect(() =>
      validateExtensionBackendContribution({ entry: './backend.js', services: [{ id: 'svc', handler: 'serve', restart: 'bad' }] }),
    ).toThrow('Extension manifest backend.services[0].restart must be one of: never, on-failure, always.');
    expect(() =>
      validateExtensionBackendContribution({ entry: './backend.js', routes: [{ method: 'TRACE', path: '/api', handler: 'route' }] }),
    ).toThrow('Extension manifest backend.routes[0].method must be one of:');
    expect(() =>
      validateExtensionBackendContribution({ entry: './backend.js', routes: [{ method: 'GET', path: 'api', handler: 'route' }] }),
    ).toThrow('backend.routes[0].path must start with /.');
    expect(() =>
      validateExtensionBackendContribution({ entry: './backend.js', routes: [{ method: 'GET', path: '/../api', handler: 'route' }] }),
    ).toThrow('backend.routes[0].path must not contain ..');
  });
});
