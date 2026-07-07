import type { Dirent } from 'node:fs';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

export interface PersonaMemoryDoc {
  id: string;
  title: string;
  path: string;
  content: string;
  updatedAt?: string;
}

export function validateDocId(id: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
}

const RESERVED_DOC_NAMES = new Set(['soul', 'agents', 'readme']);

function isReservedDocId(id: string): boolean {
  return RESERVED_DOC_NAMES.has(id);
}

function resolveDocPath(agentsDir: string, id: string): string {
  return join(resolve(agentsDir), `${id}.md`);
}

export function writePersonaMemoryDoc(agentsDir: string, id: string, title: string, body?: string): PersonaMemoryDoc {
  if (!validateDocId(id)) {
    throw new Error(`Invalid persona memory doc id: "${id}". Use lowercase alphanumeric with hyphens.`);
  }
  if (isReservedDocId(id)) {
    throw new Error(`Cannot write to reserved doc: "${id}".`);
  }

  const dir = resolve(agentsDir);
  mkdirSync(dir, { recursive: true });

  const content = [`# ${title}`, '', body ?? ''].filter(Boolean).join('\n');
  const filePath = resolveDocPath(agentsDir, id);
  writeFileSync(filePath, content, 'utf-8');

  return {
    id,
    title,
    path: filePath,
    content,
    updatedAt: new Date().toISOString(),
  };
}

export function appendToPersonaMemoryDoc(agentsDir: string, id: string, sectionTitle: string, body: string): PersonaMemoryDoc {
  if (!validateDocId(id)) {
    throw new Error(`Invalid persona memory doc id: "${id}". Use lowercase alphanumeric with hyphens.`);
  }
  if (isReservedDocId(id)) {
    throw new Error(`Cannot write to reserved doc: "${id}".`);
  }

  const dir = resolve(agentsDir);
  mkdirSync(dir, { recursive: true });
  const filePath = resolveDocPath(agentsDir, id);

  let existingContent = '';
  let existingTitle: string | undefined;
  if (existsSync(filePath)) {
    existingContent = readFileSync(filePath, 'utf-8');
    const titleMatch = existingContent.match(/^#\s+(.+)$/m);
    existingTitle = titleMatch ? titleMatch[1].trim() : id;
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]!;
  const timeStr = now.toISOString().split('T')[1]!.split('.')[0]!;
  const separator = existingContent.length > 0 ? '\n\n' : '';
  const section = `## ${dateStr} - ${sectionTitle}\n\n${body.trim()}\n\n_Recorded at ${dateStr}T${timeStr}Z._`;
  const mergedContent = existingContent
    ? `${existingContent.trim()}${separator}${section}\n`
    : `# ${existingTitle ?? sectionTitle}\n\n${section}\n`;

  writeFileSync(filePath, mergedContent, 'utf-8');

  const finalTitleMatch = mergedContent.match(/^#\s+(.+)$/m);
  return {
    id,
    title: finalTitleMatch ? finalTitleMatch[1].trim() : id,
    path: filePath,
    content: mergedContent,
    updatedAt: now.toISOString(),
  };
}

export function deletePersonaMemoryDoc(agentsDir: string, id: string): boolean {
  if (!validateDocId(id)) {
    throw new Error(`Invalid persona memory doc id: "${id}". Use lowercase alphanumeric with hyphens.`);
  }
  if (isReservedDocId(id)) {
    throw new Error(`Cannot delete reserved doc: "${id}".`);
  }

  const filePath = resolveDocPath(agentsDir, id);
  if (!existsSync(filePath)) {
    return false;
  }

  unlinkSync(filePath);
  return true;
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
    if (entry.name === 'AGENTS.md' || entry.name === 'soul.md') continue;

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
