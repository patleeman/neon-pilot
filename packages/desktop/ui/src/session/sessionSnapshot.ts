import { api } from '../client/api';
import type { SessionMeta } from '../shared/types';

let inFlightSessionsSnapshot: Promise<SessionMeta[]> | null = null;
export const INITIAL_SESSION_SNAPSHOT_LIMIT = 250;

export async function fetchSessionsSnapshot(): Promise<SessionMeta[]> {
  if (!inFlightSessionsSnapshot) {
    inFlightSessionsSnapshot = api.sessions({ limit: INITIAL_SESSION_SNAPSHOT_LIMIT }).finally(() => {
      inFlightSessionsSnapshot = null;
    });
  }

  return inFlightSessionsSnapshot;
}
