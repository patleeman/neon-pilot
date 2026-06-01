#!/usr/bin/env node
/* eslint-env node */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const productRuntimeRoots = [
  'packages/desktop/server/app',
  'packages/desktop/server/conversations',
  'packages/desktop/server/filesystem',
  'packages/desktop/server/models',
  'packages/desktop/server/prompt-assembly',
  'packages/desktop/server/routes',
  'packages/desktop/server/tools',
  'packages/desktop/server/workspace',
];
const productRuntimeFiles = ['packages/desktop/server/protocolCli.ts'];
const architectureDoc = 'docs/product-extension-process-split.md';

const filePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const forbiddenPatterns = [
  {
    pattern: /import(?:\s+type)?[\s\S]{0,250}\s+from\s+['"][^'"]*\/extensions\/extensionBackend\.js['"]/,
    message: 'product runtime code must not import extensionBackend; use ExtensionHostClient and extensionHostProtocol types',
  },
  {
    pattern: /import\s+\{[^}]*\binvokeExtensionAction\b[^}]*\}\s+from\s+['"][^'"]*\/extensions\/extensionBackend\.js['"]/,
    message: 'product runtime code must invoke extension actions through ExtensionHostClient',
  },
  {
    pattern:
      /import\s+\{[^}]*\b(?:invokeExtensionRoute|listExtensionActionTelemetry|reloadExtensionBackend|runExtensionSelfTest|checkEnabledExtensionBackendHealth|startExtensionStartupActions)\b[^}]*\}\s+from\s+['"][^'"]*\/extensions\/extensionBackend\.js['"]/,
    message: 'product runtime code must invoke extension backend operations through ExtensionHostClient',
  },
  {
    pattern: /import\(\s*['"][^'"]*\/extensions\/extensionBackend\.js['"]\s*\)[\s\S]{0,300}\binvokeExtensionAction\b/,
    message: 'product runtime code must invoke extension actions through ExtensionHostClient',
  },
  {
    pattern:
      /import\(\s*['"][^'"]*\/extensions\/extensionBackend\.js['"]\s*\)[\s\S]{0,300}\b(?:invokeExtensionRoute|listExtensionActionTelemetry|reloadExtensionBackend|runExtensionSelfTest|checkEnabledExtensionBackendHealth|startExtensionStartupActions)\b/,
    message: 'product runtime code must invoke extension backend operations through ExtensionHostClient',
  },
  {
    pattern: /import\s+\{[^}]*\binvokeExtensionProtocolEntrypoint\b[^}]*\}\s+from\s+['"][^'"]*\/extensions\/extensionBackend\.js['"]/,
    message: 'product runtime code must invoke extension protocol entrypoints through ExtensionHostClient',
  },
  {
    pattern: /import\(\s*['"][^'"]*\/extensions\/extensionBackend\.js['"]\s*\)[\s\S]{0,300}\binvokeExtensionProtocolEntrypoint\b/,
    message: 'product runtime code must invoke extension protocol entrypoints through ExtensionHostClient',
  },
  {
    pattern: /import\s+\{[^}]*\bpublishExtensionHostEvent\b[^}]*\}\s+from\s+['"][^'"]*\/extensions\/extensionSubscriptions\.js['"]/,
    message: 'product runtime code must publish extension events through ExtensionHostClient',
  },
  {
    pattern: /import\(\s*['"][^'"]*\/extensions\/extensionSubscriptions\.js['"]\s*\)[\s\S]{0,300}\bpublishExtensionHostEvent\b/,
    message: 'product runtime code must publish extension events through ExtensionHostClient',
  },
  {
    pattern: /\bcreateInProcessExtensionHostClient\b/,
    message: 'product runtime code must not construct the in-process extension host; use the RPC extension host client',
  },
  {
    pattern: /\bcreateHybridExtensionHostClient\b/,
    message: 'product runtime code must not construct a hybrid extension host fallback; use the RPC extension host client',
  },
];

function listFiles() {
  try {
    return execFileSync('git', ['ls-files', ...productRuntimeRoots], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
      .split('\n')
      .filter(Boolean)
      .concat(productRuntimeFiles);
  } catch {
    return [];
  }
}

const failures = [];
for (const file of listFiles()) {
  if (!filePattern.test(file) || file.includes('/dist/') || file.includes('.test.')) continue;
  const absolute = resolve(repoRoot, file);
  if (!existsSync(absolute)) continue;
  const text = readFileSync(absolute, 'utf8');
  for (const { pattern, message } of forbiddenPatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const line = text.slice(0, match.index).split('\n').length;
    failures.push(`${relative(repoRoot, absolute)}:${line}: ${message}`);
  }
}

const architectureDocPath = resolve(repoRoot, architectureDoc);
if (existsSync(architectureDocPath)) {
  const text = readFileSync(architectureDocPath, 'utf8');
  const staleHybridFallback = /\bhybrid\b[\s\S]{0,120}\bfallback\b/i.exec(text);
  if (staleHybridFallback) {
    const line = text.slice(0, staleHybridFallback.index).split('\n').length;
    failures.push(`${architectureDoc}:${line}: architecture doc must not describe a hybrid in-process extension-host fallback`);
  }
}

if (failures.length > 0) {
  console.error('Product runtime / extension host seam violation.');
  console.error('Product runtime modules must depend on packages/desktop/server/extensions/extensionHostClient.ts.');
  console.error(failures.join('\n'));
  process.exit(1);
}
