import { api } from '../client/api';
import type { SessionMeta } from '../shared/types';

let inFlightSessionsSnapshot: Promise<SessionMeta[]> | null = null;

export async function fetchSessionsSnapshot(): Promise<SessionMeta[]> {
  if (!inFlightSessionsSnapshot) {
    inFlightSessionsSnapshot = api.sessions().finally(() => {
      inFlightSessionsSnapshot = null;
    });
  }

  return inFlightSessionsSnapshot;
}
