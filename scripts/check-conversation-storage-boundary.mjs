#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

// Existing transcript-boundary users. Keep this list shrinking; new product code
// should use conversation service / conversations.db read-model APIs instead.
const allowed = new Set([
  'packages/desktop/server/app/localApi.ts',
  'packages/desktop/server/conversations/conversationBootstrap.ts',
  'packages/desktop/server/conversations/conversationTypes.ts',
  'packages/desktop/server/conversations/conversationRecovery.ts',
  'packages/desktop/server/conversations/conversationSearchIndex.ts',
  'packages/desktop/server/conversations/conversationService.ts',
  'packages/desktop/server/conversations/conversationSessionAssetCapability.ts',
  'packages/desktop/server/conversations/conversationSummaries.ts',
  'packages/desktop/server/conversations/liveSessionBranching.ts',
  'packages/desktop/server/conversations/liveSessionBroadcasts.ts',
  'packages/desktop/server/conversations/liveSessionCapability.ts',
  'packages/desktop/server/conversations/liveSessionCreation.ts',
  'packages/desktop/server/conversations/liveSessionEventHandling.ts',
  'packages/desktop/server/conversations/liveSessionEvents.ts',
  'packages/desktop/server/conversations/liveSessionParallelReconciliation.ts',
  'packages/desktop/server/conversations/liveSessionPersistence.ts',
  'packages/desktop/server/conversations/liveSessionPromptOps.ts',
  'packages/desktop/server/conversations/liveSessionRecovery.ts',
  'packages/desktop/server/conversations/liveSessions.ts',
  'packages/desktop/server/conversations/liveSessionStateSnapshot.ts',
  'packages/desktop/server/conversations/liveSessionSubscription.ts',
  'packages/desktop/server/conversations/liveSessionTitle.ts',
  'packages/desktop/server/conversations/liveSessionTranscript.ts',
  'packages/desktop/server/conversations/sessionExchange.ts',
  'packages/desktop/server/daemon/background-agent-runner.ts',
  'packages/desktop/server/routes/conversationState.ts',
  'packages/desktop/server/shared/appEvents.ts',
]);

const output = execFileSync(
  'git',
  ['ls-files', 'packages/desktop/server/**/*.ts', 'extensions/**/*.ts', 'installable-extensions/**/*.ts'],
  {
    cwd: root,
    encoding: 'utf8',
  },
);

const violations = [];
for (const file of output.split('\n').filter(Boolean)) {
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx') || allowed.has(file)) continue;
  const text = readFileSync(resolve(root, file), 'utf8');
  if (/from ['\"](?:\.\.?\/)+conversations\/sessions\.js['\"]/.test(text) || /from ['\"]\.\/sessions\.js['\"]/.test(text)) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error('Direct conversation transcript/session imports are restricted. Use ConversationStore/conversation service APIs instead.');
  for (const file of violations) console.error(`- ${relative(root, resolve(root, file))}`);
  process.exit(1);
}
