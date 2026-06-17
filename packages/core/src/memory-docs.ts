import { resolve } from 'path';

import { getDurableNotesDir, getKnowledgeRoot } from './runtime/paths.js';

export interface ResolveMemoryDocsOptions {
  knowledgeRoot?: string;
}

function resolveKnowledgeRootForMemory(options: ResolveMemoryDocsOptions = {}): string {
  return resolve(options.knowledgeRoot ?? getKnowledgeRoot());
}

export function getMemoryDocsDir(options: ResolveMemoryDocsOptions = {}): string {
  return getDurableNotesDir(resolveKnowledgeRootForMemory(options));
}
