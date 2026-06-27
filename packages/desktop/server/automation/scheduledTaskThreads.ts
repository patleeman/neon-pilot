import {
  type AutomationThreadMode,
  ensureAutomationThread,
  normalizeAutomationThreadModeForSelection,
  resolveAutomationThreadTitle,
  setStoredAutomationThreadBinding,
  type StoredAutomation,
} from '@neon-pilot/daemon';

import {
  readConversationSessionMeta,
  readConversationSessionMetaByFile,
  resolveConversationSessionFile,
} from '../conversations/conversationService.js';

export interface ScheduledTaskThreadInput {
  threadMode?: string | null;
  threadConversationId?: string | null;
  threadSessionFile?: string | null;
  profile?: string | null;
}

export interface ScheduledTaskThreadDetail {
  threadMode: AutomationThreadMode;
  threadConversationId?: string;
  threadTitle?: string;
}

export interface ScheduledTaskThreadDetailOptions {
  profile?: string;
}

function readOptionalString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function resolveScheduledTaskThreadBinding(input: ScheduledTaskThreadInput & { cwd?: string | null }): {
  mode: AutomationThreadMode;
  conversationId?: string;
  sessionFile?: string;
} {
  const requestedMode = readOptionalString(input.threadMode ?? undefined);
  if (requestedMode === 'none') {
    throw new Error('Automations require an owner thread.');
  }
  const mode = normalizeAutomationThreadModeForSelection(input.threadMode);

  if (mode === 'dedicated') {
    return { mode };
  }

  const conversationId = readOptionalString(input.threadConversationId);
  if (!conversationId) {
    throw new Error('Choose an existing thread.');
  }

  const sessionFile = readOptionalString(input.threadSessionFile);
  const resolvedSessionFile = sessionFile || resolveConversationSessionFile(conversationId);
  if (!resolvedSessionFile) {
    throw new Error('Selected thread was not found.');
  }

  const profile = readOptionalString(input.profile ?? undefined);
  const sessionMeta = sessionFile
    ? readConversationSessionMetaByFile(sessionFile)
    : readConversationSessionMeta(conversationId, { profile });
  if (!sessionMeta) {
    throw new Error('Selected thread was not found.');
  }
  const expectedCwd = readOptionalString(input.cwd ?? undefined);
  if (expectedCwd && sessionMeta.cwd && sessionMeta.cwd !== expectedCwd) {
    throw new Error('Selected thread must use the same working directory as the automation.');
  }

  return {
    mode,
    conversationId,
    sessionFile: resolvedSessionFile,
  };
}

export function applyScheduledTaskThreadBinding(
  taskId: string,
  input: ScheduledTaskThreadInput & {
    cwd?: string | null;
    dbPath?: string;
  },
): StoredAutomation {
  const resolved = resolveScheduledTaskThreadBinding(input);
  setStoredAutomationThreadBinding(taskId, {
    dbPath: input.dbPath,
    mode: resolved.mode,
    conversationId: resolved.conversationId,
    sessionFile: resolved.sessionFile,
  });

  return ensureAutomationThread(taskId, { dbPath: input.dbPath });
}

export function buildScheduledTaskThreadDetail(
  task: StoredAutomation,
  options: ScheduledTaskThreadDetailOptions = {},
): ScheduledTaskThreadDetail {
  const title = task.threadConversationId
    ? readConversationSessionMeta(task.threadConversationId, { profile: options.profile })?.title
    : resolveAutomationThreadTitle(task);

  return {
    threadMode: task.threadMode,
    ...(task.threadConversationId ? { threadConversationId: task.threadConversationId } : {}),
    ...(title ? { threadTitle: title } : {}),
  };
}
