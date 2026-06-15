import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getDurableSessionsDir } from '@neon-pilot/core';

import { upsertConversationCatalogSession } from './conversationCatalog.js';
import { resolveNeutralChatCwd } from './conversationCwd.js';
import { readConversationSessionMetaByFile } from './conversationService.js';

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
  const sessionDir = resolvePersistentSessionDir(cwd);
  const sessionDirAtMs = performance.now();
  mkdirSync(sessionDir, { recursive: true });
  const sessionDirEnsuredAtMs = performance.now();
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const sessionFile = join(sessionDir, `${id}.jsonl`);
  writeFileSync(sessionFile, `${JSON.stringify({ type: 'session', version: 3, id, timestamp, cwd })}\n`, { flag: 'wx' });
  const sessionFileEnsuredAtMs = performance.now();

  const meta = readConversationSessionMetaByFile(sessionFile);
  const metaAtMs = performance.now();
  if (meta) {
    upsertConversationCatalogSession(meta);
  }
  const conversationId = meta?.id || id;
  const idAtMs = performance.now();
  if (!conversationId) {
    throw new Error('Reserved conversation did not produce a conversation id.');
  }

  return {
    id: conversationId,
    sessionFile,
    cwd,
    perf: {
      cwdMs: Math.round(cwdAtMs - startedAtMs),
      sessionDirMs: Math.round(sessionDirAtMs - cwdAtMs),
      ensureSessionDirMs: Math.round(sessionDirEnsuredAtMs - sessionDirAtMs),
      ensureSessionFileMs: Math.round(sessionFileEnsuredAtMs - sessionDirEnsuredAtMs),
      metaMs: Math.round(metaAtMs - sessionFileEnsuredAtMs),
      idMs: Math.round(idAtMs - metaAtMs),
      totalMs: Math.round(idAtMs - startedAtMs),
    },
  };
}
