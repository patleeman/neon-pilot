import { describe, expect, it } from 'vitest';

import {
  applyExtensionQuarantine,
  buildFailureRecord,
  planStartupGuardQuarantines,
  pruneRecentFailureRecords,
} from './extensionCircuitBreaker';

describe('extensionCircuitBreaker', () => {
  it('builds and prunes failure records by finite timestamp cutoff', () => {
    const now = Date.parse('2026-05-23T10:00:00.000Z');
    const recent = buildFailureRecord({ operation: 'command', error: 'boom', now });

    expect(recent).toEqual({ at: '2026-05-23T10:00:00.000Z', operation: 'command', error: 'boom' });
    expect(
      pruneRecentFailureRecords(
        [
          { at: 'not-a-date', operation: 'bad', error: 'ignored' },
          { at: '2026-05-23T09:49:59.999Z', operation: 'old', error: 'ignored' },
          { at: '2026-05-23T09:50:00.000Z', operation: 'boundary', error: 'kept' },
          recent,
        ],
        Date.parse('2026-05-23T09:50:00.000Z'),
      ),
    ).toEqual([{ at: '2026-05-23T09:50:00.000Z', operation: 'boundary', error: 'kept' }, recent]);
  });

  it('quarantines extensions while preserving sorted enabled and disabled ids', () => {
    expect(
      applyExtensionQuarantine(
        {
          disabledIds: ['z-extension'],
          enabledIds: ['flaky-board', 'other-board'],
          quarantined: { old: { reason: 'old', at: '2026-05-23T09:00:00.000Z', failures: 2 } },
        },
        { extensionId: 'flaky-board', reason: 'boom', at: '2026-05-23T10:00:00.000Z', failures: 3 },
      ),
    ).toEqual({
      disabledIds: ['flaky-board', 'z-extension'],
      enabledIds: ['other-board'],
      quarantined: {
        old: { reason: 'old', at: '2026-05-23T09:00:00.000Z', failures: 2 },
        'flaky-board': { reason: 'boom', at: '2026-05-23T10:00:00.000Z', failures: 3 },
      },
    });
  });

  it('plans startup safe-mode quarantines only for enabled runtime extensions', () => {
    expect(
      planStartupGuardQuarantines(
        { disabledIds: ['already-disabled'], enabledIds: ['runtime-board', 'system-board'] },
        [
          { id: 'runtime-board', source: 'runtime', enabled: true },
          { id: 'disabled-runtime', source: 'runtime', enabled: false },
          { id: 'system-board', source: 'system', enabled: true },
        ],
        '2026-05-23T10:00:00.000Z',
      ),
    ).toEqual({
      disabledIds: ['runtime-board'],
      config: {
        disabledIds: ['already-disabled', 'runtime-board'],
        enabledIds: ['system-board'],
        quarantined: {
          'runtime-board': {
            reason: 'Disabled by extension safe mode after an unclean startup.',
            at: '2026-05-23T10:00:00.000Z',
            failures: 0,
          },
        },
      },
    });
  });
});
