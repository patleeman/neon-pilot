import type { Dirent } from 'node:fs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

export interface PersonaMemoryDoc {
  id: string;
  title: string;
  path: string;
  content: string;
  updatedAt?: string;
}

/**
 * List persona memory documents from the agents directory.
 *
 * The one-persona beta reads directly from `<desktop-root>/agents`.
 * Callers must only use this for summoned persona sessions; workers should not
 * load persona memory.
 */
export function listPersonaMemoryDocs(agentsDir: string): PersonaMemoryDoc[] {
  const dir = resolve(agentsDir);

  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const docs: PersonaMemoryDoc[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.name.startsWith('.')) continue;
    if (extname(entry.name) !== '.md') continue;
    if (entry.name === 'AGENTS.md') continue;

    const filePath = join(dir, entry.name);
    const id = basename(entry.name, '.md');
    const content = readFileSync(filePath, 'utf-8');

    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : id;

    let updatedAt: string | undefined;
    try {
      const stats = statSync(filePath);
      updatedAt = stats.mtime.toISOString();
    } catch {
      // Content is more important than best-effort file metadata.
    }

    docs.push({ id, title, path: filePath, content, updatedAt });
  }

  docs.sort((a, b) => a.id.localeCompare(b.id));

  return docs;
}
