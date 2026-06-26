import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  readTelegramBotToken,
  removeTelegramBotToken,
  TELEGRAM_SECRET_EXTENSION,
  TELEGRAM_SECRET_ID,
  writeTelegramBotToken,
} from './telegramAuth.js';

function createTempStateRoot(): string {
  const stateRoot = mkdtempSync(join(tmpdir(), 'pa-telegram-auth-'));
  mkdirSync(stateRoot, { recursive: true });
  writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));
  return stateRoot;
}

describe('telegramAuth external extension secret contract', () => {
  it('uses the externally distributed system-gateways secret id', () => {
    expect(TELEGRAM_SECRET_EXTENSION).toBe('system-gateways');
    expect(TELEGRAM_SECRET_ID).toBe('telegramBotToken');
  });

  it('stores Telegram tokens without requiring the optional system-gateways extension secret registration', () => {
    const stateRoot = createTempStateRoot();
    const authFile = join(stateRoot, 'auth.json');

    writeTelegramBotToken(authFile, stateRoot, ' token ');

    expect(readTelegramBotToken(authFile, stateRoot)).toBe('token');
    removeTelegramBotToken(authFile, stateRoot);
    expect(readTelegramBotToken(authFile, stateRoot)).toBeNull();
  });
});
