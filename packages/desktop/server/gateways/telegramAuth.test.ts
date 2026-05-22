import { beforeEach, describe, expect, it, vi } from 'vitest';

const authStorage = vi.hoisted(() => ({
  instance: { get: vi.fn(), remove: vi.fn() },
  create: vi.fn(),
}));
const secrets = vi.hoisted(() => ({ deleteSecret: vi.fn(), resolveSecret: vi.fn(), setSecret: vi.fn() }));

vi.mock('@earendil-works/pi-coding-agent', () => ({ AuthStorage: { create: authStorage.create } }));
vi.mock('../secrets/secretStore.js', () => secrets);

import { readTelegramBotToken, removeTelegramBotToken, writeTelegramBotToken } from './telegramAuth.js';

describe('telegramAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStorage.create.mockReturnValue(authStorage.instance);
    authStorage.instance.get.mockReturnValue(null);
    secrets.resolveSecret.mockReturnValue(null);
  });

  it('prefers token from secret storage over legacy auth file credentials', () => {
    secrets.resolveSecret.mockReturnValue(' secret-token ');
    authStorage.instance.get.mockReturnValue({ type: 'api_key', key: 'legacy-token' });

    expect(readTelegramBotToken('/auth.json', '/state')).toBe('secret-token');
    expect(secrets.resolveSecret).toHaveBeenCalledWith('system-gateways', 'telegramBotToken', '/state');
    expect(authStorage.create).not.toHaveBeenCalled();
  });

  it('falls back to trimmed legacy api key credentials', () => {
    authStorage.instance.get.mockReturnValue({ type: 'api_key', key: ' legacy-token ' });

    expect(readTelegramBotToken('/auth.json', '/state')).toBe('legacy-token');
    expect(authStorage.create).toHaveBeenCalledWith('/auth.json');
    expect(authStorage.instance.get).toHaveBeenCalledWith('telegram');
  });

  it('ignores empty or non-api-key legacy credentials', () => {
    authStorage.instance.get.mockReturnValue({ type: 'oauth', key: 'token' });
    expect(readTelegramBotToken('/auth.json', '/state')).toBeNull();

    authStorage.instance.get.mockReturnValue({ type: 'api_key', key: '   ' });
    expect(readTelegramBotToken('/auth.json', '/state')).toBeNull();
  });

  it('writes token to secret storage and removes legacy auth entry', () => {
    writeTelegramBotToken('/auth.json', '/state', ' token ');

    expect(secrets.setSecret).toHaveBeenCalledWith('system-gateways', 'telegramBotToken', 'token', '/state');
    expect(authStorage.create).toHaveBeenCalledWith('/auth.json');
    expect(authStorage.instance.remove).toHaveBeenCalledWith('telegram');
  });

  it('rejects blank tokens', () => {
    expect(() => writeTelegramBotToken('/auth.json', '/state', '   ')).toThrow('Telegram bot token required');
    expect(secrets.setSecret).not.toHaveBeenCalled();
  });

  it('removes token from secret and legacy auth storage', () => {
    removeTelegramBotToken('/auth.json', '/state');

    expect(secrets.deleteSecret).toHaveBeenCalledWith('system-gateways', 'telegramBotToken', '/state');
    expect(authStorage.instance.remove).toHaveBeenCalledWith('telegram');
  });
});
