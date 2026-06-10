#!/usr/bin/env node
/* eslint-env node */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listExtensionManifests(root = join(repoRoot, 'extensions')) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name, 'extension.json'))
    .filter((path) => existsSync(path))
    .sort();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function collectAdminSurfaceInventory(manifests = listExtensionManifests().map((path) => ({ path, manifest: readJson(path) }))) {
  const tools = [];
  const cliCommands = [];
  for (const { path, manifest } of manifests) {
    const extensionId = manifest.id;
    for (const tool of asArray(manifest.contributes?.tools)) {
      tools.push({ extensionId, manifestPath: path, id: tool.id, name: tool.name, description: tool.description ?? '' });
    }
    for (const command of asArray(manifest.contributes?.cliCommands)) {
      cliCommands.push({ extensionId, manifestPath: path, id: command.id, command: command.command, action: command.action });
    }
  }
  return { tools, cliCommands };
}

export function checkUnifiedAdminSurface(manifests) {
  const inventory = collectAdminSurfaceInventory(manifests);
  const failures = [];
  const neonPilotTools = inventory.tools.filter((tool) => tool.name === 'neon_pilot');
  if (neonPilotTools.length !== 1 || neonPilotTools[0]?.extensionId !== 'system-neon-pilot-admin-cli') {
    failures.push(`Expected exactly one internal neon_pilot tool from system-neon-pilot-admin-cli; found ${JSON.stringify(neonPilotTools)}`);
  }

  const adminLikeTools = inventory.tools.filter((tool) => {
    const haystack = `${tool.name ?? ''} ${tool.id ?? ''} ${tool.description ?? ''}`.toLowerCase();
    return /(^|[_-])admin($|[_-])|(^|[_-])admin-like|admin tool|admin surface|self-admin|self admin|control plane|control-plane/.test(haystack);
  });
  for (const tool of adminLikeTools) {
    const description = String(tool.description ?? '').toLowerCase();
    if (tool.extensionId === 'system-mcp' && description.includes('not a neon pilot self-admin surface')) continue;
    if (tool.name !== 'neon_pilot') failures.push(`Unexpected internal admin-like tool ${tool.name ?? tool.id} in ${tool.extensionId}`);
  }

  const mcpManifest = manifests
    ? manifests.find((entry) => entry.manifest?.id === 'system-mcp')
    : listExtensionManifests().map((path) => ({ path, manifest: readJson(path) })).find((entry) => entry.manifest.id === 'system-mcp');
  const mcpTools = asArray(mcpManifest?.manifest?.contributes?.tools);
  for (const tool of mcpTools) {
    const haystack = `${tool.name ?? ''} ${tool.id ?? ''} ${tool.description ?? ''}`.toLowerCase();
    if (haystack.includes('self-admin') && !haystack.includes('not a neon pilot self-admin surface')) {
      failures.push('system-mcp describes itself as a Neon Pilot self-admin surface.');
    }
  }

  const packageJson = readJson(join(repoRoot, 'package.json'));
  if (packageJson.bin?.['neon-pilot'] !== './scripts/neon-pilot-cli.mjs') failures.push('package.json must expose external neon-pilot CLI bin.');
  return { ok: failures.length === 0, failures, inventory };
}

export function checkHeartbeatConfig(manifests) {
  const failures = [];
  const admin = (manifests ?? listExtensionManifests().map((path) => ({ path, manifest: readJson(path) }))).find(
    (entry) => entry.manifest.id === 'system-neon-pilot-admin-cli',
  )?.manifest;
  const tool = asArray(admin?.contributes?.tools).find((entry) => entry.name === 'neon_pilot');
  const commands = tool?.inputSchema?.properties?.command?.enum ?? [];
  for (const command of ['heartbeat_start', 'heartbeat_list', 'heartbeat_stop']) {
    if (!commands.includes(command)) failures.push(`neon_pilot schema missing ${command}.`);
  }
  const cliCommands = asArray(admin?.contributes?.cliCommands).map((entry) => entry.command);
  for (const command of ['heartbeats start', 'heartbeats list', 'heartbeats stop']) {
    if (!cliCommands.includes(command)) failures.push(`Admin CLI missing ${command}.`);
  }
  const backend = readFileSync(join(repoRoot, 'extensions/system-neon-pilot-admin-cli/src/backend.ts'), 'utf8');
  if (!backend.includes("return `*/${minutes} * * * *`;")) failures.push('Heartbeat cron helper no longer emits */N * * * * expressions.');
  if (!backend.includes("policies: [{ kind: 'overlap', enabled: true, behavior: 'skip' }]")) failures.push('Heartbeat start/stop must retain overlap skip policy.');
  if (!backend.includes('applyScheduledTaskThreadBinding')) failures.push('Heartbeat start must bind scheduled task to a conversation thread.');
  return { ok: failures.length === 0, failures };
}

function runCheck(name, command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'pipe', encoding: 'utf8' });
  return {
    name,
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
    status: result.status,
  };
}

export function runStaticDoctor() {
  const manifests = listExtensionManifests().map((path) => ({ path, manifest: readJson(path) }));
  const checks = [
    { name: 'unified-admin-surface', ...checkUnifiedAdminSurface(manifests) },
    { name: 'heartbeat-config', ...checkHeartbeatConfig(manifests) },
    runCheck('packaged-extension-validity', process.execPath, ['scripts/check-packaged-extensions.mjs']),
  ];
  return { ok: checks.every((check) => check.ok), checks };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runStaticDoctor();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}
