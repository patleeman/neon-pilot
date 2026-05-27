import type { KnowledgeEntry } from '@neon-pilot/extensions/data';

export function normalizeKnowledgeDir(dir: string): string {
  const trimmed = dir.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) {
    return '';
  }

  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export function getKnowledgeEntryParentDir(entry: Pick<KnowledgeEntry, 'id' | 'kind'>): string {
  const rawId = entry.kind === 'folder' ? entry.id.replace(/\/+$/, '') : entry.id;
  const parts = rawId.split('/');
  parts.pop();
  return parts.length > 0 ? `${parts.join('/')}/` : '';
}

export function canDropKnowledgeEntry(entry: Pick<KnowledgeEntry, 'id' | 'kind'>, targetDirInput: string): boolean {
  const targetDir = normalizeKnowledgeDir(targetDirInput);
  const currentDir = getKnowledgeEntryParentDir(entry);

  if (currentDir === targetDir) {
    return false;
  }

  if (entry.kind === 'folder') {
    const entryDir = normalizeKnowledgeDir(entry.id);
    if (targetDir === entryDir) {
      return false;
    }

    if (targetDir.startsWith(entryDir)) {
      return false;
    }
  }

  return true;
}
