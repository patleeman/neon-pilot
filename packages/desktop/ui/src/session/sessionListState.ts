import type { SessionMeta } from '../shared/types';

function areSessionMetaEqual(left: SessionMeta, right: SessionMeta): boolean {
  const leftKeys = Object.keys(left) as Array<keyof SessionMeta>;
  const rightKeys = Object.keys(right) as Array<keyof SessionMeta>;
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

export function mergeSessionSnapshotPreservingOrder(
  previousSessions: readonly SessionMeta[] | null,
  nextSessions: readonly SessionMeta[],
): SessionMeta[] {
  if (!previousSessions || previousSessions.length === 0) {
    return [...nextSessions];
  }

  const previousSessionById = new Map(previousSessions.map((session) => [session.id, session]));
  const nextSessionById = new Map(
    nextSessions.map((session) => {
      const previous = previousSessionById.get(session.id);
      return [session.id, previous && areSessionMetaEqual(previous, session) ? previous : session] as const;
    }),
  );
  const orderedSessions = previousSessions
    .map((session) => nextSessionById.get(session.id))
    .filter((session): session is SessionMeta => Boolean(session));
  const knownSessionIdSet = new Set(orderedSessions.map((session) => session.id));

  for (const session of nextSessions) {
    if (knownSessionIdSet.has(session.id)) {
      continue;
    }

    orderedSessions.push(session);
  }

  if (
    orderedSessions.length === previousSessions.length &&
    orderedSessions.every((session, index) => Object.is(session, previousSessions[index]))
  ) {
    return previousSessions as SessionMeta[];
  }

  return orderedSessions;
}

export function replaceSessionMetaPreservingOrder(sessions: readonly SessionMeta[], nextSession: SessionMeta): SessionMeta[] {
  const existingIndex = sessions.findIndex((session) => session.id === nextSession.id);
  if (existingIndex === -1) {
    return [...sessions, nextSession];
  }

  if (sessions[existingIndex] === nextSession) {
    return sessions as SessionMeta[];
  }

  const nextSessions = [...sessions];
  nextSessions[existingIndex] = nextSession;
  return nextSessions;
}

export function removeSessionMetaPreservingOrder(sessions: readonly SessionMeta[], sessionId: string): SessionMeta[] {
  const existingIndex = sessions.findIndex((session) => session.id === sessionId);
  if (existingIndex === -1) {
    return sessions as SessionMeta[];
  }

  return [...sessions.slice(0, existingIndex), ...sessions.slice(existingIndex + 1)];
}

/** Update just the isRunning field on a session in the list, preserving everything else.
 *  Returns the same array reference if the session is not found or running hasn't changed. */
export function updateSessionRunningPreservingOrder(sessions: readonly SessionMeta[], sessionId: string, running: boolean): SessionMeta[] {
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return sessions as SessionMeta[];
  const existing = sessions[index];
  if (!existing || existing.isRunning === running) return sessions as SessionMeta[];
  const next = [...sessions];
  next[index] = { ...existing, isRunning: running };
  return next;
}
