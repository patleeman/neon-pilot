import {
  api,
  type KnowledgeBacklinksResult,
  type KnowledgeBaseState,
  type KnowledgeEntry,
  type KnowledgeFileContent,
  type KnowledgeFileListResult,
  type KnowledgeImageUploadResult,
  type KnowledgeSearchResponse,
  type KnowledgeShareImportResult,
  type KnowledgeTreeResult,
} from '@neon-pilot/extensions/data';

const EXTENSION_ID = 'system-knowledge';
const KNOWLEDGE_ACTION_TIMEOUT_MS = 15_000;

interface ExtensionActionResponse<T> {
  ok?: boolean;
  result?: T;
  error?: string;
}

async function invoke<T>(actionId: string, input: unknown = {}): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Knowledge action '${actionId}' timed out after ${KNOWLEDGE_ACTION_TIMEOUT_MS / 1000}s`));
    }, KNOWLEDGE_ACTION_TIMEOUT_MS);
  });

  try {
    const response = (await Promise.race([
      api.invokeExtensionAction(EXTENSION_ID, actionId, input),
      timeout,
    ])) as ExtensionActionResponse<T>;
    if (response.ok === false) {
      throw new Error(response.error ?? `Knowledge action '${actionId}' failed.`);
    }
    return response.result as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export const knowledgeApi = {
  state: () => invoke<KnowledgeBaseState>('readState'),
  updateState: (input: { repoUrl?: string | null; branch?: string | null; directories?: string[] | null }) =>
    invoke<KnowledgeBaseState>('updateState', input),
  sync: () => invoke<KnowledgeBaseState>('sync'),
  listFiles: () => invoke<KnowledgeFileListResult>('knowledgeListFiles'),
  tree: (dir?: string) => invoke<KnowledgeTreeResult>('knowledgeTree', dir ? { dir } : {}),
  readFile: (id: string) => invoke<KnowledgeFileContent>('knowledgeReadFile', { id }),
  writeFile: (id: string, content: string) => invoke<KnowledgeEntry>('knowledgeWriteFile', { id, content }),
  createFolder: (id: string) => invoke<KnowledgeEntry>('knowledgeCreateFolder', { id }),
  deleteFile: (id: string) => invoke<{ ok: boolean }>('knowledgeDeleteFile', { id }),
  rename: (id: string, newName: string) => invoke<KnowledgeEntry>('knowledgeRename', { id, newName }),
  move: (id: string, targetDir: string) => invoke<KnowledgeEntry>('knowledgeMove', { id, targetDir }),
  backlinks: (id: string) => invoke<KnowledgeBacklinksResult>('knowledgeBacklinks', { id }),
  search: (q: string, limit = 20) => invoke<KnowledgeSearchResponse>('knowledgeSearch', { q, limit }),
  uploadImage: (filename: string, dataUrl: string) => invoke<KnowledgeImageUploadResult>('knowledgeUploadImage', { filename, dataUrl }),
  importUrl: (input: { url: string; title?: string; directoryId?: string; sourceApp?: string }) =>
    invoke<KnowledgeShareImportResult>('knowledgeImportUrl', input),
  assetUrl: (id: string) => `/api/extensions/system-knowledge/asset?id=${encodeURIComponent(id)}`,
};
