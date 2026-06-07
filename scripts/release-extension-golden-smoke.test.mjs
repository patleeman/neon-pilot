import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { evaluateTextExpectations, loadMatrix, parseArgs, validateMatrix } from './release-extension-golden-smoke.mjs';

describe('release extension golden smoke', () => {
  it('loads the default golden matrix', () => {
    const matrix = loadMatrix(new URL('./release-extension-golden-matrix.json', import.meta.url));

    expect(matrix.requiredExtensions).toContain('system-extension-manager');
    expect(matrix.routes.some((route) => route.path === '/extensions')).toBe(true);
    expect(matrix.actions.some((action) => action.extensionId === 'system-extension-manager')).toBe(true);
    expect(matrix.agentTools.expectedNames).toContain('bash');
    expect(matrix.agentTools.expectedNames).toContain('todo');
    expect(matrix.agentTools.invocations.some((invocation) => invocation.name === 'scheduled_task')).toBe(true);
  });

  it('rejects malformed route and action entries', () => {
    expect(() =>
      validateMatrix({
        schemaVersion: 1,
        requiredExtensions: ['system-extension-manager'],
        appRoutes: [],
        registryMinimums: {},
        agentTools: { expectedNames: [], invocations: [], contextInvocations: [] },
        routes: [{ extensionId: 'system-extension-manager', path: 'extensions', text: [] }],
        actions: [],
        installablePackages: [],
        catalogInstalls: [],
      }),
    ).toThrow('route path must start with /');

    expect(() =>
      validateMatrix({
        schemaVersion: 1,
        requiredExtensions: ['system-extension-manager'],
        appRoutes: [],
        registryMinimums: {},
        agentTools: { expectedNames: [], invocations: [], contextInvocations: [] },
        routes: [],
        actions: [{ extensionId: 'system-extension-manager', input: {}, text: [] }],
        installablePackages: [],
        catalogInstalls: [],
      }),
    ).toThrow('action actionId is required');
  });

  it('reports missing text expectations against strings and objects', () => {
    expect(evaluateTextExpectations('Extensions Knowledge', ['Extensions', 'Settings'])).toEqual(['Settings']);
    expect(evaluateTextExpectations({ ok: true, extensions: ['system-knowledge'] }, ['system-knowledge'])).toEqual([]);
  });

  it('parses app, matrix, and preserve-state arguments', () => {
    expect(parseArgs(['--', '--app=/tmp/Neon Pilot.app', '--matrix', '/tmp/matrix.json', '--preserve-state'])).toMatchObject({
      appPath: '/tmp/Neon Pilot.app',
      matrixPath: '/tmp/matrix.json',
      preserveState: true,
    });
  });

  it('is wired into release verification scripts', () => {
    const localVerify = readFileSync(new URL('./verify-desktop-release-build.mjs', import.meta.url), 'utf8');
    const publish = readFileSync(new URL('./publish-desktop-release.mjs', import.meta.url), 'utf8');

    expect(localVerify).toContain('scripts/release-extension-golden-smoke.mjs');
    expect(publish).toContain('release-extension-golden-smoke.mjs');
  });
});
