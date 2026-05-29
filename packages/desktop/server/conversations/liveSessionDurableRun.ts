import { publishAppEvent } from '../shared/appEvents.js';
import { logError } from '../shared/logging.js';
import { syncWebLiveConversationRun, type WebLiveConversationRunState } from './conversationRuns.js';

export interface LiveSessionDurableRunHost {
  sessionId: string;
  cwd: string;
  title: string;
  lastDurableRunState?: WebLiveConversationRunState;
  session: {
    sessionFile?: string | null;
    sessionName?: string;
  };
}

export function resolveLiveSessionProfile(): string | undefined {
  return 'shared';
}

export function resolveDurableRunTitle(entry: LiveSessionDurableRunHost): string {
  const sessionName = entry.session.sessionName?.trim();
  if (sessionName) {
    return sessionName;
  }

  return entry.title.trim();
}

export async function syncLiveSessionDurableRun(
  entry: LiveSessionDurableRunHost,
  state: WebLiveConversationRunState,
  input: { force?: boolean; lastError?: string } = {},
): Promise<void> {
  if (!input.force && entry.lastDurableRunState === state && !input.lastError) {
    return;
  }

  entry.lastDurableRunState = state;

  const sessionFile = entry.session.sessionFile?.trim();
  if (!sessionFile) {
    return;
  }

  try {
    await syncWebLiveConversationRun({
      conversationId: entry.sessionId,
      sessionFile,
      cwd: entry.cwd,
      title: resolveDurableRunTitle(entry),
      profile: resolveLiveSessionProfile(),
      state,
      lastError: input.lastError,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('conversation durable run sync failed', { sessionId: entry.sessionId, state, message });
    publishAppEvent({
      type: 'notification',
      extensionId: 'core',
      message: `Durable run sync failed: ${message}`,
      severity: 'error',
    });
  }
}

export type { WebLiveConversationRunState };
