import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  readNumericSourceExport,
  readRecentOperationDurationMs,
  samplesAfterCount,
  summarizeCpuOffenders,
} from './perf-desktop-smoke-utils.mjs';

describe('perf desktop smoke utils', () => {
  it('reads numeric source exports used by smoke guardrails', () => {
    const dir = mkdtempSync(join(tmpdir(), 'neon-smoke-utils-'));
    const file = join(dir, 'constants.ts');
    writeFileSync(file, 'export const INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS = 24;\n');

    expect(readNumericSourceExport(file, 'INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS')).toBe(24);
    expect(() => readNumericSourceExport(file, 'MISSING_EXPORT')).toThrow(/Unable to read numeric export/);
  });

  it('summarizes sustained CPU offenders across samples', () => {
    expect(
      summarizeCpuOffenders([
        {
          offenders: [
            { pid: 3, cpu: 5.1, command: 'renderer' },
            { pid: 1, cpu: 12.4, command: 'main' },
          ],
        },
        {
          offenders: [
            { pid: 1, cpu: 17.6, command: 'main' },
            { pid: 2, cpu: 8.2, command: 'main' },
          ],
        },
        { offenders: [] },
      ]),
    ).toEqual([
      { command: 'main', samples: 3, avgCpu: 12.7, peakCpu: 17.6, pids: [1, 2] },
      { command: 'renderer', samples: 1, avgCpu: 5.1, peakCpu: 5.1, pids: [3] },
    ]);
  });

  it('scopes samples to entries recorded after a captured count', () => {
    const samples = [{ id: 'old-a' }, { id: 'old-b' }, { id: 'new-a' }, { id: 'new-b' }];

    expect(samplesAfterCount(samples, 2)).toEqual([{ id: 'new-a' }, { id: 'new-b' }]);
    expect(samplesAfterCount(samples, 10)).toEqual([]);
    expect(samplesAfterCount(samples, 0)).toBe(samples);
    expect(samplesAfterCount(null, 2)).toEqual([]);
  });

  it('reads the largest matching recent operation duration', () => {
    expect(
      readRecentOperationDurationMs(
        [
          'rpc:createDesktopLiveSession:34ms',
          'rpc:submitDesktopLiveSessionPrompt:1ms',
          'rpc:submitDesktopLiveSessionPrompt:12.5ms',
          'rpc:submitDesktopLiveSessionPrompt:not-a-duration',
          'rpc:submitDesktopLiveSessionPrompt:7ms',
        ],
        'rpc:submitDesktopLiveSessionPrompt',
      ),
    ).toBe(12.5);
  });

  it('ignores missing, malformed, and non-matching recent operation entries', () => {
    expect(readRecentOperationDurationMs(null, 'rpc:submitDesktopLiveSessionPrompt')).toBeNull();
    expect(readRecentOperationDurationMs(['rpc:createDesktopLiveSession:34ms'], 'rpc:submitDesktopLiveSessionPrompt')).toBeNull();
    expect(readRecentOperationDurationMs([42, 'rpc:submitDesktopLiveSessionPrompt:bad'], 'rpc:submitDesktopLiveSessionPrompt')).toBeNull();
  });
});
