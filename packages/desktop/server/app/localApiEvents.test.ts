import { describe, expect, it } from 'vitest';

import { mapSnapshotEventToDesktopAppEvent } from './localApiEvents';

describe('localApiEvents', () => {
  it('maps snapshot events to desktop bridge events', () => {
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'sessions_snapshot', sessions: [{ id: 'one' }] })).toEqual({
      type: 'sessions',
      sessions: [{ id: 'one' }],
    });
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'tasks_snapshot', tasks: [{ id: 'task' }] })).toEqual({
      type: 'tasks',
      tasks: [{ id: 'task' }],
    });
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'runs_snapshot', result: { runs: [] } })).toEqual({
      type: 'runs',
      result: { runs: [] },
    });
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'daemon_snapshot', state: { status: 'ready' } })).toEqual({
      type: 'daemon',
      state: { status: 'ready' },
    });
  });

  it('uses safe defaults for malformed snapshot event payloads', () => {
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'sessions_snapshot', sessions: 'bad' })).toEqual({ type: 'sessions', sessions: [] });
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'tasks_snapshot', tasks: null })).toEqual({ type: 'tasks', tasks: [] });
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'runs_snapshot' })).toEqual({ type: 'runs', result: null });
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'daemon_snapshot' })).toEqual({ type: 'daemon', state: null });
  });

  it('ignores unknown or invalid events', () => {
    expect(mapSnapshotEventToDesktopAppEvent(null)).toBeNull();
    expect(mapSnapshotEventToDesktopAppEvent({ type: 'other' })).toBeNull();
  });
});
