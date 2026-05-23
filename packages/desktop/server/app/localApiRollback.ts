import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

import { SessionManager } from '@earendil-works/pi-coding-agent';

export const MAX_DESKTOP_ROLLBACK_TURNS = 100;

export function validateDesktopRollbackTurns(numTurns: number): void {
  if (!Number.isSafeInteger(numTurns) || numTurns <= 0 || numTurns > MAX_DESKTOP_ROLLBACK_TURNS) {
    throw new Error('numTurns must be a positive integer.');
  }
}

export function resolveRollbackLeafId(sessionFile: string, numTurns: number): string | null {
  const sessionManager = SessionManager.open(sessionFile);
  const branch = sessionManager.getBranch();
  const userMessageEntries = branch.filter((entry) => entry.type === 'message' && entry.message.role === 'user');

  if (userMessageEntries.length === 0) {
    throw new Error('No user turns are available to roll back.');
  }

  if (numTurns >= userMessageEntries.length) {
    return null;
  }

  const firstRemovedTurn = userMessageEntries[userMessageEntries.length - numTurns];
  if (!firstRemovedTurn) {
    throw new Error('Could not resolve rollback target.');
  }

  return firstRemovedTurn.parentId ?? null;
}

export function rewriteConversationSessionToLeaf(sessionFile: string, leafId: string | null): void {
  const sessionManager = SessionManager.open(sessionFile);
  const header = sessionManager.getHeader();
  if (!header) {
    throw new Error('Conversation session header is missing.');
  }

  if (leafId === null) {
    writeFileSync(sessionFile, `${JSON.stringify(header)}\n`, 'utf-8');
    return;
  }

  const branchedSessionFile = sessionManager.createBranchedSession(leafId);
  if (!branchedSessionFile || !existsSync(branchedSessionFile)) {
    throw new Error('Unable to create rollback snapshot.');
  }

  try {
    const lines = readFileSync(branchedSessionFile, 'utf-8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      throw new Error('Rollback snapshot was empty.');
    }

    lines[0] = JSON.stringify(header);
    writeFileSync(sessionFile, `${lines.join('\n')}\n`, 'utf-8');
  } finally {
    try {
      unlinkSync(branchedSessionFile);
    } catch {
      // Ignore temporary rollback snapshot cleanup failures.
    }
  }
}
