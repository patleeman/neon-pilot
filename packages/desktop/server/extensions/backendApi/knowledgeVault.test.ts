import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ callServerModuleExport: vi.fn() }));
const fsRoot = vi.hoisted(() => ({
  stat: vi.fn(),
  list: vi.fn(),
  exists: vi.fn(),
  readText: vi.fn(),
  writeText: vi.fn(),
  writeBytes: vi.fn(),
  createDirectory: vi.fn(),
  remove: vi.fn(),
  move: vi.fn(),
}));
const authority = vi.hoisted(() => ({ defaultFileSystemAuthority: { requestRoot: vi.fn() } }));

vi.mock('./serverModuleResolver.js', () => resolver);
vi.mock('../../filesystem/filesystemAuthority.js', () => authority);

import { knowledgeVault } from './knowledgeVault.js';

function setupVaultRoot() {
  resolver.callServerModuleExport.mockImplementation(async (specifier: string, name: string, ...args: unknown[]) => {
    if (specifier === '@neon-pilot/core' && name === 'getVaultRoot') return '/vault';
    if (specifier === '../../shared/appEvents.js' && name === 'invalidateAppTopics') return undefined;
    if (specifier === '../../knowledge/vaultFiles.js' && name === 'listVaultFiles') return [{ id: 'note.md' }];
    if (specifier === '../../knowledge/vaultFiles.js' && name === 'resolveMentionedVaultFiles')
      return args[0] === 'none' ? [] : [{ id: 'note.md', path: 'note.md' }];
    if (specifier === '../../knowledge/vaultFiles.js' && name === 'buildReferencedVaultFilesContext') return 'Referenced files context';
    throw new Error(`unexpected ${specifier} ${name}`);
  });
  authority.defaultFileSystemAuthority.requestRoot.mockResolvedValue(fsRoot);
}

describe('backendApi/knowledgeVault', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupVaultRoot();
  });

  it('lists files through the vault files server module using the core vault root', async () => {
    await expect(knowledgeVault.listFiles()).resolves.toEqual({ root: '/vault', files: [{ id: 'note.md' }] });
    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('@neon-pilot/core', 'getVaultRoot');
    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('../../knowledge/vaultFiles.js', 'listVaultFiles', '/vault');
  });

  it('returns sorted tree entries and hides dotfiles while keeping folders', async () => {
    fsRoot.list.mockResolvedValue([
      { type: 'file', name: 'z.md', path: 'z.md', size: 10, modifiedAt: '2026-01-02T00:00:00.000Z' },
      { type: 'file', name: '.hidden', path: '.hidden', size: 1 },
      { type: 'directory', name: '.config', path: '.config', modifiedAt: '2026-01-01T00:00:00.000Z' },
      { type: 'directory', name: 'docs', path: 'docs' },
    ]);

    await expect(knowledgeVault.tree({ dir: 'notes' })).resolves.toEqual({
      entries: [
        expect.objectContaining({ id: '.config/', kind: 'folder', name: '.config' }),
        expect.objectContaining({ id: 'docs/', kind: 'folder', name: 'docs' }),
        expect.objectContaining({ id: 'z.md', kind: 'file', name: 'z.md', sizeBytes: 10 }),
      ],
    });
    expect(authority.defaultFileSystemAuthority.requestRoot).toHaveBeenCalledWith(
      expect.objectContaining({ access: ['list', 'metadata'], reason: 'knowledge vault tree' }),
    );
    expect(fsRoot.list).toHaveBeenCalledWith('notes', { depth: 0, excludeNames: ['.git', 'node_modules', '.DS_Store'] });
  });

  it('rejects unsafe vault ids before requesting filesystem access', async () => {
    authority.defaultFileSystemAuthority.requestRoot.mockClear();
    await expect(knowledgeVault.readFile({ id: '../secrets.md' })).rejects.toThrow('invalid path');
    expect(authority.defaultFileSystemAuthority.requestRoot).not.toHaveBeenCalled();
  });

  it('reads and writes vault files with scoped filesystem access and emits invalidation', async () => {
    fsRoot.exists.mockResolvedValue(true);
    fsRoot.stat.mockResolvedValue({ type: 'file', size: 5, modifiedAt: '2026-05-22T00:00:00.000Z' });
    fsRoot.readText.mockResolvedValue('hello');

    await expect(knowledgeVault.readFile({ id: 'note.md' })).resolves.toEqual({
      id: 'note.md',
      content: 'hello',
      updatedAt: '2026-05-22T00:00:00.000Z',
    });

    fsRoot.stat.mockResolvedValue({ type: 'file', size: 7, modifiedAt: '2026-05-23T00:00:00.000Z' });
    await expect(knowledgeVault.writeFile({ id: 'note.md', content: 'updated' })).resolves.toEqual(
      expect.objectContaining({ id: 'note.md', kind: 'file', sizeBytes: 7, updatedAt: '2026-05-23T00:00:00.000Z' }),
    );
    expect(fsRoot.writeText).toHaveBeenCalledWith('note.md', 'updated');
    expect(resolver.callServerModuleExport).toHaveBeenCalledWith('../../shared/appEvents.js', 'invalidateAppTopics', 'knowledgeBase');
  });

  it('searches markdown notes by title, path, and content with bounded limits', async () => {
    fsRoot.list.mockResolvedValue([
      { type: 'file', name: 'Alpha.md', path: 'Alpha.md' },
      { type: 'file', name: 'Beta.md', path: 'folder/Beta.md' },
      { type: 'file', name: 'image.png', path: 'image.png' },
    ]);
    fsRoot.readText.mockImplementation(async (id: string) => (id === 'Alpha.md' ? 'Alpha body' : 'contains search needle here'));

    await expect(knowledgeVault.search({ q: 'needle', limit: 100 })).resolves.toEqual({
      results: [expect.objectContaining({ id: 'folder/Beta.md', title: 'Beta', excerpt: 'contains search needle here' })],
    });
    expect(fsRoot.list).toHaveBeenCalledWith('', { depth: 100, excludeNames: ['.git', 'node_modules', '.DS_Store'] });
  });

  it('uploads base64 image data into attachments with a sanitized filename', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    await expect(knowledgeVault.uploadImage({ filename: 'Bad Name.txt', dataUrl: 'data:image/png;base64,aGVsbG8=' })).resolves.toEqual({
      id: '_attachments/1234-Bad-Name.png',
      url: '/api/vault/asset?id=_attachments%2F1234-Bad-Name.png',
    });
    expect(fsRoot.writeBytes).toHaveBeenCalledWith('_attachments/1234-Bad-Name.png', Buffer.from('hello'));
  });

  it('resolves prompt references into context blocks only when mentions resolve', async () => {
    await expect(knowledgeVault.resolvePromptReferences({ text: 'include [[note]]' })).resolves.toEqual({
      contextBlocks: [{ content: 'Referenced files context' }],
      references: [{ kind: 'knowledgeFile', id: 'note.md', path: 'note.md' }],
    });
    await expect(knowledgeVault.resolvePromptReferences({ text: 'none' })).resolves.toEqual({ contextBlocks: [], references: [] });
  });
});
