import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  hasTelegramAccessApprovals,
  isTelegramMessageApproved,
  readTelegramAccessPolicy,
  resolveTelegramAccessFile,
  writeTelegramAccessPolicy,
} from './telegramAccess.js';

describe('telegram access policy', () => {
  it('persists normalized approved user and chat ids with private file mode', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'telegram-access-'));

    const written = writeTelegramAccessPolicy(stateRoot, 'shared/profile', {
      approvedUserIds: [' 123 ', '123', '', '456'],
      approvedChatIds: [' -100 ', '-100'],
    });

    expect(written).toEqual({ approvedUserIds: ['123', '456'], approvedChatIds: ['-100'] });
    expect(readTelegramAccessPolicy(stateRoot, 'shared/profile')).toEqual(written);
    const persisted = JSON.parse(readFileSync(resolveTelegramAccessFile(stateRoot, 'shared/profile'), 'utf-8')) as {
      version: number;
    };
    expect(persisted.version).toBe(1);
  });

  it('requires either approved sender user id or chat id', () => {
    const policy = { approvedUserIds: ['111'], approvedChatIds: ['222'] };

    expect(hasTelegramAccessApprovals(policy)).toBe(true);
    expect(isTelegramMessageApproved(policy, { chatId: '222' })).toBe(true);
    expect(isTelegramMessageApproved(policy, { chatId: '333', userId: '111' })).toBe(true);
    expect(isTelegramMessageApproved(policy, { chatId: '333', userId: '444' })).toBe(false);
    expect(hasTelegramAccessApprovals({ approvedUserIds: [], approvedChatIds: [] })).toBe(false);
  });

  it('falls back to an empty policy for missing or corrupt files', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'telegram-access-'));

    expect(readTelegramAccessPolicy(stateRoot, 'missing')).toEqual({ approvedUserIds: [], approvedChatIds: [] });
  });
});
