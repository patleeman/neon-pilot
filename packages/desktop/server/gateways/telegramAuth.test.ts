import { beforeEach, describe, expect, it, vi } from 'vitest';

const authStorage = vi.hoisted(() => ({
  instance: { get: vi.fn(), remove: vi.fn() },
  create: vi.fn(),
}));
const secrets = vi.hoisted(() => ({ deleteSecret: vi.fn(), resolveSecret: vi.fn(), setSecret: vi.fn() }));
const providerSecrets = vi.hoisted(() => ({
  deleteProviderApiKeySecret: vi.fn(),
  resolveProviderApiKey: vi.fn(),
  setProviderApiKeySecret: vi.fn(),
}));

vi.mock('@earendil-works/pi-coding-agent', () => ({ AuthStorage: { create: authStorage.create } }));
vi.mock('../secrets/secretStore.js', () => ({ ...secrets, ...providerSecrets }));

import { readTelegramBotToken, removeTelegramBotToken, writeTelegramBotToken } from './telegramAuth.js';

describe('telegramAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStorage.create.mockReturnValue(authStorage.instance);
    authStorage.instance.get.mockReturnValue(null);
    providerSecrets.resolveProviderApiKey.mockReturnValue(null);
    secrets.resolveSecret.mockReturnValue(null);
  });

  it('prefers host-owned provider token storage', () => {
    providerSecrets.resolveProviderApiKey.mockReturnValue(' provider-token ');
    secrets.resolveSecret.mockReturnValue(' extension-token ');

    expect(readTelegramBotToken('/auth.json', '/state')).toBe('provider-token');
    expect(providerSecrets.resolveProviderApiKey).toHaveBeenCalledWith('telegram', '/state');
    expect(secrets.resolveSecret).not.toHaveBeenCalled();
    expect(authStorage.create).not.toHaveBeenCalled();
  });

  it('prefers token from secret storage over legacy auth file credentials', () => {
    secrets.resolveSecret.mockReturnValue(' secret-token ');
    authStorage.instance.get.mockReturnValue({ type: 'api_key', key: 'legacy-token' });

    expect(readTelegramBotToken('/auth.json', '/state')).toBe('secret-token');
    expect(secrets.resolveSecret).toHaveBeenCalledWith('host-gateways', 'telegramBotToken', '/state');
    expect(authStorage.create).not.toHaveBeenCalled();
  });

  it('falls back to trimmed legacy api key credentials', () => {
    authStorage.instance.get.mockReturnValue({ type: 'api_key', key: ' legacy-token ' });

    expect(readTelegramBotToken('/auth.json', '/state')).toBe('legacy-token');
    expect(authStorage.create).toHaveBeenCalledWith('/auth.json');
    expect(authStorage.instance.get).toHaveBeenCalledWith('telegram');
  });

  it('treats a missing optional gateway secret declaration as unconfigured', () => {
    secrets.resolveSecret.mockImplementation(() => {
      throw new Error('Secret "host-gateways/telegramBotToken" is not registered by an enabled extension.');
    });

    expect(readTelegramBotToken('/auth.json', '/state')).toBeNull();
    expect(authStorage.create).toHaveBeenCalledWith('/auth.json');
  });

  it('ignores empty or non-api-key legacy credentials', () => {
    authStorage.instance.get.mockReturnValue({ type: 'oauth', key: 'token' });
    expect(readTelegramBotToken('/auth.json', '/state')).toBeNull();

    authStorage.instance.get.mockReturnValue({ type: 'api_key', key: '   ' });
    expect(readTelegramBotToken('/auth.json', '/state')).toBeNull();
  });

  it('writes token to host-owned provider secret storage and removes legacy auth entry', () => {
    writeTelegramBotToken('/auth.json', '/state', ' token ');

    expect(providerSecrets.setProviderApiKeySecret).toHaveBeenCalledWith('telegram', 'token', '/state');
    expect(secrets.setSecret).not.toHaveBeenCalled();
    expect(authStorage.create).toHaveBeenCalledWith('/auth.json');
    expect(authStorage.instance.remove).toHaveBeenCalledWith('telegram');
  });

  it('rejects blank tokens', () => {
    expect(() => writeTelegramBotToken('/auth.json', '/state', '   ')).toThrow('Telegram bot token required');
    expect(providerSecrets.setProviderApiKeySecret).not.toHaveBeenCalled();
  });

  it('removes token from host and registered extension secret storage plus legacy auth storage', () => {
    removeTelegramBotToken('/auth.json', '/state');

    expect(providerSecrets.deleteProviderApiKeySecret).toHaveBeenCalledWith('telegram', '/state');
    expect(secrets.deleteSecret).toHaveBeenCalledWith('host-gateways', 'telegramBotToken', '/state');
    expect(authStorage.instance.remove).toHaveBeenCalledWith('telegram');
  });

  it('removes token when the optional extension secret declaration is absent', () => {
    secrets.deleteSecret.mockImplementation(() => {
      throw new Error('Secret "host-gateways/telegramBotToken" is not registered by an enabled extension.');
    });

    removeTelegramBotToken('/auth.json', '/state');

    expect(providerSecrets.deleteProviderApiKeySecret).toHaveBeenCalledWith('telegram', '/state');
    expect(authStorage.instance.remove).toHaveBeenCalledWith('telegram');
  });
});
