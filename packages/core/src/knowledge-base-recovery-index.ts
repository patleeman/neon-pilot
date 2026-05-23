import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export function readKnowledgeBaseRecoveryIndex(filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as { entries?: unknown };
    return Array.isArray(parsed.entries)
      ? parsed.entries.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function appendKnowledgeBaseRecoveryIndex(filePath: string, entryId: string, ensureParentDirectory: (path: string) => void): number {
  const entries = readKnowledgeBaseRecoveryIndex(filePath);
  entries.push(entryId);
  ensureParentDirectory(filePath);
  writeFileSync(filePath, `${JSON.stringify({ entries }, null, 2)}\n`);
  return entries.length;
}
