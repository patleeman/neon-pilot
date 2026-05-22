import { beforeEach, describe, expect, it, vi } from 'vitest';

const crypto = vi.hoisted(() => ({
  bytes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  createHash: vi.fn(() => ({
    update(value: string) {
      return { digest: () => `hash:${value}` };
    },
  })),
  randomBytes: vi.fn((size: number) =>
    Buffer.from(Array.from({ length: size }, (_value, index) => crypto.bytes[index % crypto.bytes.length] ?? 1)),
  ),
}));
const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  existsSync: vi.fn((path: string) => fs.files.has(path)),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn((path: string) => fs.files.get(path) ?? ''),
  writeFileSync: vi.fn((path: string, content: string) => fs.files.set(path, content)),
}));

vi.mock('node:crypto', () => crypto);
vi.mock('node:fs', () => fs);

import {
  createCompanionPairingCode,
  pairCompanionDevice,
  readCompanionDeviceAdminState,
  readCompanionDeviceByToken,
  resolveCompanionAuthStateFile,
  revokeCompanionDevice,
  updateCompanionDeviceLabel,
} from './auth-store.js';

describe('companion auth store', () => {
  const stateRoot = '/state';
  const authFile = '/state/companion/auth.json';
  const now = new Date('2026-05-22T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    fs.files.clear();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    crypto.bytes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  });

  it('resolves the auth state file under companion state', () => {
    expect(resolveCompanionAuthStateFile(stateRoot)).toBe(authFile);
  });

  it('creates pairing codes, stores only hashes, and lists pending pairings', () => {
    const code = createCompanionPairingCode(stateRoot, { now });

    expect(code).toMatchObject({
      code: 'AAAA-AAAA-AAAA',
      createdAt: '2026-05-22T12:00:00.000Z',
      expiresAt: '2026-05-22T12:10:00.000Z',
    });
    expect(code.id).toMatch(/^pair-[a-z0-9]+-000102030405$/);
    expect(fs.mkdirSync).toHaveBeenCalledWith('/state/companion', { recursive: true, mode: 0o700 });
    expect(fs.files.get(authFile)).toContain('hash:AAAAAAAAAAAA');
    expect(fs.files.get(authFile)).not.toContain('AAAA-AAAA-AAAA');
    expect(readCompanionDeviceAdminState(stateRoot, { now }).pendingPairings).toEqual([
      { id: code.id, createdAt: code.createdAt, expiresAt: code.expiresAt },
    ]);
  });

  it('pairs devices with normalized labels and removes consumed pairing codes', () => {
    const code = createCompanionPairingCode(stateRoot, { now });
    crypto.bytes = Array.from({ length: 32 }, (_value, index) => index + 1);

    const result = pairCompanionDevice(stateRoot, code.code.toLowerCase(), { deviceLabel: '  My   Phone  ', now });

    expect(result.device).toMatchObject({
      deviceLabel: 'My Phone',
      createdAt: '2026-05-22T12:00:00.000Z',
      lastUsedAt: '2026-05-22T12:00:00.000Z',
      expiresAt: '2026-06-21T12:00:00.000Z',
    });
    expect(result.device.id).toMatch(/^device-[a-z0-9]+-010203040506$/);
    expect(readCompanionDeviceAdminState(stateRoot, { now }).pendingPairings).toEqual([]);
    expect(() => pairCompanionDevice(stateRoot, code.code, { now })).toThrow('Pairing code is invalid or expired.');
  });

  it('validates pairing codes and filters expired/corrupt store entries', () => {
    expect(() => pairCompanionDevice(stateRoot, '   ', { now })).toThrow('Pairing code required.');
    fs.files.set(
      authFile,
      JSON.stringify({
        pairingCodes: [
          { id: 'expired', codeHash: 'hash:X', createdAt: now.toISOString(), expiresAt: new Date(now.getTime() - 1).toISOString() },
        ],
        devices: [
          { id: 'bad' },
          {
            id: 'expired-device',
            deviceLabel: 'Old',
            tokenHash: 'hash:t',
            createdAt: now.toISOString(),
            lastUsedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() - 1).toISOString(),
          },
        ],
      }),
    );
    expect(readCompanionDeviceAdminState(stateRoot, { now })).toEqual({ pendingPairings: [], devices: [] });
  });

  it('reads devices by token, touches sessions after the interval, and respects touch=false', () => {
    const code = createCompanionPairingCode(stateRoot, { now });
    crypto.bytes = Array.from({ length: 32 }, (_value, index) => index + 1);
    const { bearerToken, device } = pairCompanionDevice(stateRoot, code.code, { now });

    expect(readCompanionDeviceByToken(stateRoot, ' ', { now })).toBeNull();
    expect(readCompanionDeviceByToken(stateRoot, bearerToken, { now: new Date(now.getTime() + 60_000) })).toMatchObject({
      id: device.id,
      lastUsedAt: now.toISOString(),
    });
    expect(readCompanionDeviceByToken(stateRoot, bearerToken, { now: new Date(now.getTime() + 6 * 60_000), touch: false })).toMatchObject({
      lastUsedAt: now.toISOString(),
    });
    expect(readCompanionDeviceByToken(stateRoot, bearerToken, { now: new Date(now.getTime() + 6 * 60_000) })).toMatchObject({
      lastUsedAt: '2026-05-22T12:06:00.000Z',
      expiresAt: '2026-06-21T12:06:00.000Z',
    });
  });

  it('revokes devices and updates labels for active devices only', () => {
    const code = createCompanionPairingCode(stateRoot, { now });
    const { device } = pairCompanionDevice(stateRoot, code.code, { deviceLabel: '', now });

    expect(updateCompanionDeviceLabel(stateRoot, device.id, '  New   Label  ', { now })).toMatchObject({ deviceLabel: 'New Label' });
    expect(revokeCompanionDevice(stateRoot, device.id, { now })).toMatchObject({ id: device.id, revokedAt: now.toISOString() });
    expect(updateCompanionDeviceLabel(stateRoot, device.id, 'Other', { now })).toBeNull();
    expect(revokeCompanionDevice(stateRoot, device.id, { now })).toBeNull();
    expect(readCompanionDeviceByToken(stateRoot, 'missing', { now })).toBeNull();
  });
});
