import { describe, expect, it } from 'vitest';

import { buildExtensionQuarantineDiagnostic, mergeExtensionInstallDiagnostics } from './extensionInstallSummaryDiagnostics';

describe('extensionInstallSummaryDiagnostics', () => {
  it('builds quarantine diagnostics', () => {
    expect(buildExtensionQuarantineDiagnostic(undefined)).toBeNull();
    expect(buildExtensionQuarantineDiagnostic({ reason: 'boom', failures: 3, at: 'now' })).toBe(
      'Extension disabled by circuit breaker: boom (3 failures at now)',
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
