import { describe, expect, it } from 'vitest';

import {
  buildKnowledgeBaseMaintenanceState,
  planKnowledgeBaseRepositoryMaintenance,
  runKnowledgeBaseRepositoryMaintenance,
} from './knowledge-base-maintenance';

describe('knowledge-base-maintenance', () => {
  const parseTimestampMs = (value: string | null | undefined) => (value ? Date.parse(value) : null);

  it('plans auto, full, or no maintenance from stored timestamps', () => {
    const timestamp = '2026-05-23T12:00:00.000Z';
    const nowMs = Date.parse(timestamp);
    const interval = 60_000;

    expect(
      planKnowledgeBaseRepositoryMaintenance({
        storedState: null,
        timestamp,
        nowMs,
        parseTimestampMs,
        autoMaintenanceIntervalMs: interval,
        fullMaintenanceIntervalMs: interval,
      }).task,
    ).toBe('auto');

    expect(
      planKnowledgeBaseRepositoryMaintenance({
        storedState: { version: 1, files: {}, lastMaintenanceAt: timestamp, lastFullMaintenanceAt: '2026-05-23T11:58:00.000Z' },
        timestamp,
        nowMs,
        parseTimestampMs,
        autoMaintenanceIntervalMs: interval,
        fullMaintenanceIntervalMs: interval,
      }).task,
    ).toBe('gc');

    expect(
      planKnowledgeBaseRepositoryMaintenance({
        storedState: { version: 1, files: {}, lastMaintenanceAt: timestamp, lastFullMaintenanceAt: timestamp },
        timestamp,
        nowMs,
        parseTimestampMs,
        autoMaintenanceIntervalMs: interval,
        fullMaintenanceIntervalMs: interval,
      }).task,
    ).toBe(null);
  });

  it('builds persisted maintenance timestamps after successful tasks', () => {
    expect(buildKnowledgeBaseMaintenanceState({ task: 'gc', timestamp: 'now', storedState: null })).toEqual({
      lastMaintenanceAt: 'now',
      lastFullMaintenanceAt: 'now',
    });
    expect(
      buildKnowledgeBaseMaintenanceState({
        task: 'auto',
        timestamp: 'now',
        storedState: { version: 1, files: {}, lastFullMaintenanceAt: 'before' },
      }),
    ).toEqual({ lastMaintenanceAt: 'now', lastFullMaintenanceAt: 'before' });
  });

  it('falls back from git maintenance to gc commands', () => {
    const calls: string[][] = [];
    const runGit = (_cwd: string, args: string[]) => {
      calls.push(args);
      if (args[0] === 'maintenance') {
        throw new Error('unsupported');
      }
    };

    expect(runKnowledgeBaseRepositoryMaintenance(runGit, '/repo', 'gc')).toBe(true);
    expect(calls).toEqual([
      ['maintenance', 'run', '--task=gc', '--quiet'],
      ['gc', '--quiet'],
    ]);
  });
});
