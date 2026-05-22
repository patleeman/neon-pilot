import { beforeEach, describe, expect, it, vi } from 'vitest';

const crypto = vi.hoisted(() => ({ randomUUID: vi.fn(() => 'uuid-1') }));
const fs = vi.hoisted(() => ({
  files: new Map<string, string>(),
  existsSync: vi.fn((path: string) => fs.files.has(path)),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn((path: string) => fs.files.get(path) ?? ''),
  writeFileSync: vi.fn((path: string, content: string) => fs.files.set(path, content)),
}));
const os = vi.hoisted(() => ({ hostname: vi.fn(() => 'test-host') }));

vi.mock('node:crypto', () => crypto);
vi.mock('node:fs', () => fs);
vi.mock('node:os', () => os);

import { readCompanionHostState, resolveCompanionHostStateFile, updateCompanionHostLabel, writeCompanionHostState } from './host-state.js';

describe('companion host state', () => {
  const stateRoot = '/state';
  const filePath = '/state/companion/host-state.json';

  beforeEach(() => {
    vi.clearAllMocks();
    fs.files.clear();
  });

  it('resolves host state file under companion state', () => {
    expect(resolveCompanionHostStateFile(stateRoot)).toBe(filePath);
  });

  it('creates and persists default state when no file exists', () => {
    expect(readCompanionHostState(stateRoot)).toEqual({ hostInstanceId: 'host_uuid-1', hostLabel: 'test-host' });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/state/companion', { recursive: true, mode: 0o700 });
    expect(JSON.parse(fs.files.get(filePath) ?? '{}')).toEqual({ hostInstanceId: 'host_uuid-1', hostLabel: 'test-host' });
  });

  it('normalizes existing state and repairs the file', () => {
    fs.files.set(filePath, JSON.stringify({ hostInstanceId: ' id-1 ', hostLabel: ' My   Host ' }));

    expect(readCompanionHostState(stateRoot)).toEqual({ hostInstanceId: 'id-1', hostLabel: 'My Host' });
    expect(JSON.parse(fs.files.get(filePath) ?? '{}')).toEqual({ hostInstanceId: 'id-1', hostLabel: 'My Host' });
  });

  it('falls back for corrupt or incomplete state', () => {
    fs.files.set(filePath, 'not json');
    expect(readCompanionHostState(stateRoot)).toEqual({ hostInstanceId: 'host_uuid-1', hostLabel: 'test-host' });

    crypto.randomUUID.mockReturnValueOnce('uuid-2');
    fs.files.set(filePath, JSON.stringify({ hostLabel: '' }));
    expect(readCompanionHostState(stateRoot)).toEqual({ hostInstanceId: 'host_uuid-2', hostLabel: 'test-host' });
  });

  it('writes normalized state and truncates long labels', () => {
    const longLabel = ` ${'x'.repeat(140)} `;
    expect(writeCompanionHostState(stateRoot, { hostInstanceId: ' id ', hostLabel: longLabel })).toEqual({
      hostInstanceId: 'id',
      hostLabel: 'x'.repeat(120),
    });
  });

  it('updates host label while preserving host instance id', () => {
    fs.files.set(filePath, JSON.stringify({ hostInstanceId: 'host-1', hostLabel: 'Old' }));
    expect(updateCompanionHostLabel(stateRoot, ' New   Label ')).toEqual({ hostInstanceId: 'host-1', hostLabel: 'New Label' });
  });
});
