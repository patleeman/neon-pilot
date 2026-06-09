#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

// Existing transcript-boundary users. Keep this list shrinking; new product code
// should use conversation service / conversations.db read-model APIs instead.
const allowed = new Set([
  'packages/desktop/server/conversations/conversationDisplayBlocks.ts',
  'packages/desktop/server/conversations/conversationTranscriptOps.ts',
  'packages/desktop/server/conversations/conversationTypes.ts',
  'packages/desktop/server/conversations/conversationService.ts',
]);

function walkTrackedFallback(dir) {
  const absoluteDir = resolve(root, dir);
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules') return [];
      return walkTrackedFallback(child);
    }
    return child.endsWith('.ts') || child.endsWith('.tsx') ? [child] : [];
  });
}

function listCandidateFiles() {
  try {
    return execFileSync('git', ['ls-files', 'packages/desktop/server/**/*.ts', 'extensions/**/*.ts'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [...walkTrackedFallback('packages/desktop/server'), ...walkTrackedFallback('extensions')];
  }
}

const violations = [];
for (const file of listCandidateFiles()) {
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || allowed.has(file)) continue;
  const absolutePath = resolve(root, file);
  if (!existsSync(absolutePath)) continue;
  const text = readFileSync(absolutePath, 'utf8');
  if (/from ['\"](?:\.\.?\/)+conversations\/sessions\.js['\"]/.test(text) || /from ['\"]\.\/sessions\.js['\"]/.test(text)) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error('Direct conversation transcript/session imports are restricted. Use ConversationStore/conversation service APIs instead.');
  for (const file of violations) console.error(`- ${relative(root, resolve(root, file))}`);
  process.exit(1);
}
