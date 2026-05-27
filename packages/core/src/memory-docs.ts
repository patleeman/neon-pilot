import { mkdirSync } from 'fs';
import { resolve } from 'path';

import { getDurableNotesDir, getKnowledgeRoot } from './runtime/paths.js';

export interface ResolveMemoryDocsOptions {
  knowledgeRoot?: string;
}

export interface LegacyMemoryMigrationRecord {
  from: string;
  to: string;
}

export interface LegacyMemoryMigrationResult {
  memoryDir: string;
  migratedFiles: LegacyMemoryMigrationRecord[];
}

function resolveKnowledgeRootForMemory(options: ResolveMemoryDocsOptions = {}): string {
  return resolve(options.knowledgeRoot ?? getKnowledgeRoot());
}

export function getMemoryDocsDir(options: ResolveMemoryDocsOptions = {}): string {
  return getDurableNotesDir(resolveKnowledgeRootForMemory(options));
}

export function migrateLegacyProfileMemoryDirs(options: ResolveMemoryDocsOptions = {}): LegacyMemoryMigrationResult {
  const notesDir = getMemoryDocsDir({ knowledgeRoot: resolveKnowledgeRootForMemory(options) });

  mkdirSync(notesDir, { recursive: true });

  return {
    memoryDir: notesDir,
    migratedFiles: [],
  };
}
