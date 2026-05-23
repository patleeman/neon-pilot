import { describe, expect, it } from 'vitest';

import { appendMappedSnapshotEvent, shouldBuildTopicEvents } from './localApiTopicEvents';

describe('localApiTopicEvents', () => {
  it('builds topic events once per topic', () => {
    const seenTopics = new Set<string>();
    expect(shouldBuildTopicEvents({ topic: 'sessions', seenTopics })).toBe(true);
    expect(shouldBuildTopicEvents({ topic: 'sessions', seenTopics })).toBe(false);
    expect(shouldBuildTopicEvents({ topic: 'workspace', seenTopics })).toBe(true);
  });

  it('appends mapped snapshot events only when mapping returns a value', () => {
    const events: Array<{ type: string }> = [];
    appendMappedSnapshotEvent({ events, snapshotEvent: 'sessions', mapSnapshotEvent: (event) => ({ type: event }) });
    appendMappedSnapshotEvent({ events, snapshotEvent: 'ignored', mapSnapshotEvent: () => null });
    expect(events).toEqual([{ type: 'sessions' }]);
  });
});
