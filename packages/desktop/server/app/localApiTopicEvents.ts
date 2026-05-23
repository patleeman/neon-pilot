export function shouldBuildTopicEvents(input: { topic: string; seenTopics: Set<string> }): boolean {
  if (input.seenTopics.has(input.topic)) {
    return false;
  }

  input.seenTopics.add(input.topic);
  return true;
}

export function appendMappedSnapshotEvent<TSnapshot, TMapped>(input: {
  events: TMapped[];
  snapshotEvent: TSnapshot;
  mapSnapshotEvent: (event: TSnapshot) => TMapped | null | undefined;
}): void {
  const mappedEvent = input.mapSnapshotEvent(input.snapshotEvent);
  if (mappedEvent) {
    input.events.push(mappedEvent);
  }
}
