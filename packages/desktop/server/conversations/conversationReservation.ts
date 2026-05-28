import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { getDurableSessionsDir } from '@neon-pilot/core';

import { resolveNeutralChatCwd } from './conversationCwd.js';
import { readConversationSessionMetaByFile } from './conversationService.js';
import { ensureSessionFileExists } from './liveSessionPersistence.js';

function resolvePersistentSessionDir(cwd: string): string {
  const safePath = `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;
  return join(getDurableSessionsDir(), safePath);
}

export function reserveConversationSession(input: { cwd?: string | null; profile?: string }): {
  id: string;
  sessionFile: string;
  cwd: string;
  perf?: Record<string, number>;
} {
  const startedAtMs = performance.now();
  const profile = input.profile?.trim() || 'shared';
  const cwd = input.cwd?.trim() || resolveNeutralChatCwd(profile);
  const cwdAtMs = performance.now();
  const sessionManager = SessionManager.create(cwd, resolvePersistentSessionDir(cwd));
  const sessionManagerAtMs = performance.now();
  ensureSessionFileExists(sessionManager);
  const sessionFileEnsuredAtMs = performance.now();
  const sessionFile = sessionManager.getSessionFile()?.trim();
  const sessionFileAtMs = performance.now();
  if (!sessionFile) {
    throw new Error('Reserved conversation did not produce a session file.');
  }

  const meta = readConversationSessionMetaByFile(sessionFile);
  const metaAtMs = performance.now();
  const id = meta?.id || sessionManager.getSessionId();
  const idAtMs = performance.now();
  if (!id) {
    throw new Error('Reserved conversation did not produce a conversation id.');
  }

  return {
    id,
    sessionFile,
    cwd,
    perf: {
      cwdMs: Math.round(cwdAtMs - startedAtMs),
      sessionManagerMs: Math.round(sessionManagerAtMs - cwdAtMs),
      ensureSessionFileMs: Math.round(sessionFileEnsuredAtMs - sessionManagerAtMs),
      sessionFileMs: Math.round(sessionFileAtMs - sessionFileEnsuredAtMs),
      metaMs: Math.round(metaAtMs - sessionFileAtMs),
      idMs: Math.round(idAtMs - metaAtMs),
      totalMs: Math.round(idAtMs - startedAtMs),
    },
  };
}
