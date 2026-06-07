import { describe, expect, it } from 'vitest';

import { buildExtensionQuarantineDiagnostic, mergeExtensionInstallDiagnostics } from './extensionInstallSummaryDiagnostics';

describe('extensionInstallSummaryDiagnostics', () => {
  it('builds quarantine diagnostics', () => {
    expect(buildExtensionQuarantineDiagnostic(undefined)).toBeNull();
    expect(buildExtensionQuarantineDiagnostic({ reason: 'boom', failures: 3, at: 'now' })).toBe(
      'Extension disabled by circuit breaker: boom (3 failures at now)',
    );
    expect(
      buildExtensionQuarantineDiagnostic({
        reason: 'Disabled by extension safe mode after an unclean startup.',
        failures: 0,
        at: '2026-06-07T13:50:37.668Z',
      }),
    ).toBe(
      'Extension disabled by startup safe mode: Neon Pilot found a stale extension startup marker from a previous launch. No extension-specific failure was recorded, so this was a protective quarantine rather than a circuit-breaker failure. Recorded at 2026-06-07T13:50:37.668Z.',
    );
  });

  it('merges normal, quarantine, and health diagnostics', () => {
    expect(mergeExtensionInstallDiagnostics({ diagnostics: [] })).toEqual({});
    expect(mergeExtensionInstallDiagnostics({ diagnostics: ['a'], quarantineDiagnostic: 'q' })).toEqual({ diagnostics: ['a', 'q'] });
    expect(mergeExtensionInstallDiagnostics({ diagnostics: ['a'], quarantineDiagnostic: 'q', healthError: 'bad' })).toEqual({
      healthError: 'bad',
      diagnostics: ['a', 'q', 'Backend health check failed: bad'],
    });
  });
});
