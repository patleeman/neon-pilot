import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readTelegramBotToken, removeTelegramBotToken, writeTelegramBotToken } from './telegramAuth.js';

function createTempStateRoot(): string {
  return mkdtempSync(join(tmpdir(), 'neon-gateways-secret-'));
}

describe('telegramAuth extension secret integration', () => {
  let stateRoot: string;
  let authFile: string;

  beforeEach(() => {
    stateRoot = createTempStateRoot();
    authFile = join(stateRoot, 'auth.json');
    mkdirSync(stateRoot, { recursive: true });
    writeFileSync(join(stateRoot, 'settings.json'), JSON.stringify({ secrets: { provider: 'file' } }));
    delete process.env.TELEGRAM_BOT_TOKEN;
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it('resolves the system-gateways Telegram token through the real extension secret registry', () => {
    expect(readTelegramBotToken(authFile, stateRoot)).toBeNull();

    writeTelegramBotToken(authFile, stateRoot, ' token ');

    expect(readTelegramBotToken(authFile, stateRoot)).toBe('token');

    removeTelegramBotToken(authFile, stateRoot);

    expect(readTelegramBotToken(authFile, stateRoot)).toBeNull();
  });
});
