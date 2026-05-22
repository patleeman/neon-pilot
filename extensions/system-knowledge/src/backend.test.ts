import { beforeEach, describe, expect, it, vi } from 'vitest';

const knowledge = vi.hoisted(() => ({
  readKnowledgeState: vi.fn(),
  syncKnowledgeState: vi.fn(),
  updateKnowledgeState: vi.fn(),
}));
const vault = vi.hoisted(() => ({
  knowledgeVault: {
    listFiles: vi.fn(),
    tree: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    createFolder: vi.fn(),
    deleteFile: vi.fn(),
    rename: vi.fn(),
    move: vi.fn(),
    backlinks: vi.fn(),
    search: vi.fn(),
    uploadImage: vi.fn(),
    importUrl: vi.fn(),
    resolvePromptReferences: vi.fn(),
  },
}));

vi.mock('@neon-pilot/extensions/backend/knowledge', () => knowledge);
vi.mock('@neon-pilot/extensions/backend/knowledgeVault', () => vault);

import {
  readState,
  resolvePromptReferences,
  sync,
  updateState,
  vaultBacklinks,
  vaultCreateFolder,
  vaultDeleteFile,
  vaultImportUrl,
  vaultListFiles,
  vaultMove,
  vaultReadFile,
  vaultRename,
  vaultSearch,
  vaultTree,
  vaultUploadImage,
  vaultWriteFile,
} from './backend.js';

describe('system-knowledge backend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards knowledge state operations to the backend API', async () => {
    knowledge.readKnowledgeState.mockResolvedValue({ configured: true });
    knowledge.updateKnowledgeState.mockResolvedValue({ branch: 'main' });
    knowledge.syncKnowledgeState.mockResolvedValue({ lastSyncStatus: 'ok' });

    await expect(readState()).resolves.toEqual({ configured: true });
    await expect(updateState({ repoUrl: 'git@example.com:kb.git', branch: 'main' })).resolves.toEqual({ branch: 'main' });
    await expect(sync()).resolves.toEqual({ lastSyncStatus: 'ok' });

    expect(knowledge.updateKnowledgeState).toHaveBeenCalledWith({ repoUrl: 'git@example.com:kb.git', branch: 'main' });
  });

  it('forwards vault file operations to the knowledge vault API', async () => {
    vault.knowledgeVault.listFiles.mockResolvedValue({ files: [] });
    vault.knowledgeVault.tree.mockResolvedValue({ entries: [] });
    vault.knowledgeVault.readFile.mockResolvedValue({ content: 'hello' });
    vault.knowledgeVault.writeFile.mockResolvedValue({ id: 'note.md' });
    vault.knowledgeVault.createFolder.mockResolvedValue({ id: 'docs/' });
    vault.knowledgeVault.deleteFile.mockResolvedValue({ ok: true });
    vault.knowledgeVault.rename.mockResolvedValue({ id: 'renamed.md' });
    vault.knowledgeVault.move.mockResolvedValue({ id: 'docs/note.md' });

    await expect(vaultListFiles()).resolves.toEqual({ files: [] });
    await expect(vaultTree({ dir: 'docs' })).resolves.toEqual({ entries: [] });
    await expect(vaultReadFile({ id: 'note.md' })).resolves.toEqual({ content: 'hello' });
    await expect(vaultWriteFile({ id: 'note.md', content: 'updated' })).resolves.toEqual({ id: 'note.md' });
    await expect(vaultCreateFolder({ id: 'docs' })).resolves.toEqual({ id: 'docs/' });
    await expect(vaultDeleteFile({ id: 'note.md' })).resolves.toEqual({ ok: true });
    await expect(vaultRename({ id: 'note.md', newName: 'renamed.md' })).resolves.toEqual({ id: 'renamed.md' });
    await expect(vaultMove({ id: 'note.md', targetDir: 'docs' })).resolves.toEqual({ id: 'docs/note.md' });

    expect(vault.knowledgeVault.tree).toHaveBeenCalledWith({ dir: 'docs' });
    expect(vault.knowledgeVault.writeFile).toHaveBeenCalledWith({ id: 'note.md', content: 'updated' });
  });

  it('forwards vault graph, search, upload, import, and prompt reference operations', async () => {
    vault.knowledgeVault.backlinks.mockResolvedValue({ backlinks: [] });
    vault.knowledgeVault.search.mockResolvedValue({ results: [] });
    vault.knowledgeVault.uploadImage.mockResolvedValue({ id: '_attachments/image.png' });
    vault.knowledgeVault.importUrl.mockResolvedValue({ id: 'imported.md' });
    vault.knowledgeVault.resolvePromptReferences.mockResolvedValue({ contextBlocks: [], references: [] });

    await expect(vaultBacklinks({ id: 'note.md' })).resolves.toEqual({ backlinks: [] });
    await expect(vaultSearch({ q: 'term', limit: 5 })).resolves.toEqual({ results: [] });
    await expect(vaultUploadImage({ filename: 'image.png', dataUrl: 'data:image/png;base64,aGVsbG8=' })).resolves.toEqual({
      id: '_attachments/image.png',
    });
    await expect(
      vaultImportUrl({ url: 'https://example.com', title: 'Example', directoryId: 'inbox', sourceApp: 'test' }),
    ).resolves.toEqual({ id: 'imported.md' });
    await expect(resolvePromptReferences({ text: 'Use [[note]]' })).resolves.toEqual({ contextBlocks: [], references: [] });
  });
});
