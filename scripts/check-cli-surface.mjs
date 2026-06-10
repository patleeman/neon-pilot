#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const cliBin = resolve(repoRoot, 'scripts/neon-pilot-cli.mjs');
const repeat = readRepeat(process.argv.slice(2));
const failures = [];

function readRepeat(args) {
  const index = args.findIndex((arg) => arg === '--repeat' || arg.startsWith('--repeat='));
  if (index < 0) return 1;
  const value = args[index]?.includes('=') ? args[index].split('=')[1] : args[index + 1];
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliBin, ...args], {
    cwd: repoRoot,
    encoding: 'utf-8',
    timeout: options.timeoutMs ?? 30_000,
    env: { ...process.env, NEON_PILOT_REPO_ROOT: process.env.NEON_PILOT_REPO_ROOT || repoRoot },
  });
  return {
    args,
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertCliOk(result, label) {
  assert(result.status === 0, `${label} failed with ${result.status}: ${result.stderr || result.stdout}`);
  assert(!result.error, `${label} errored: ${result.error?.message ?? ''}`);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${label} did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function readSystemExtensionManifests() {
  const root = resolve(repoRoot, 'extensions');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = join(root, entry.name, 'extension.json');
      if (!existsSync(manifestPath)) return null;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      return { extensionId: manifest.id ?? entry.name, manifestPath, manifest };
    })
    .filter(Boolean);
}

function collectManifestCliCommands() {
  return readSystemExtensionManifests().flatMap(({ extensionId, manifestPath, manifest }) =>
    Array.isArray(manifest.contributes?.cliCommands)
      ? manifest.contributes.cliCommands.map((command, index) => ({ extensionId, manifestPath, index, ...command }))
      : [],
  );
}

function validateManifestCliCommands(commands) {
  const seenCommands = new Map();
  for (const command of commands) {
    const label = `${command.manifestPath}: contributes.cliCommands[${command.index}]`;
    assert(typeof command.id === 'string' && command.id.trim(), `${label} is missing id.`);
    assert(typeof command.command === 'string' && command.command.trim(), `${label} is missing command.`);
    assert(typeof command.action === 'string' && command.action.trim(), `${label} is missing action.`);
    assert(
      typeof command.description === 'string' && command.description.trim(),
      `${label} (${command.command}) needs a human-readable description.`,
    );
    if (command.usage !== undefined) assert(typeof command.usage === 'string' && command.usage.trim(), `${label} has an empty usage.`);
    if (command.examples !== undefined) {
      assert(Array.isArray(command.examples), `${label} examples must be an array.`);
      for (const [exampleIndex, example] of (command.examples ?? []).entries()) {
        assert(typeof example === 'string' && example.includes('neon-pilot '), `${label} examples[${exampleIndex}] must be copy-pasteable.`);
      }
    }
    const normalized = command.command.trim().replace(/\s+/g, ' ');
    const owner = seenCommands.get(normalized);
    assert(!owner, `${label} duplicates command "${normalized}" already declared by ${owner ?? 'another extension'}.`);
    seenCommands.set(normalized, command.extensionId);
  }
}

function validateRuntimeCommands(discoveredCommands, manifestCommands) {
  const discoveredByCommand = new Map(discoveredCommands.map((command) => [command.command, command]));
  for (const command of discoveredCommands) {
    assert(typeof command.id === 'string' && command.id.trim(), `Runtime command "${command.command}" is missing id.`);
    assert(typeof command.command === 'string' && command.command.trim(), `Runtime command "${command.id}" is missing command.`);
    assert(
      typeof command.description === 'string' && command.description.trim(),
      `Runtime command "${command.command}" needs a description for human help.`,
    );
  }
  for (const command of manifestCommands) {
    const normalized = command.command.trim().replace(/\s+/g, ' ');
    assert(discoveredByCommand.has(normalized), `System extension command "${normalized}" is not discoverable at runtime.`);
  }
}

function smokeCli(iteration) {
  const label = `iteration ${iteration}`;
  const help = runCli(['--help']);
  assertCliOk(help, `${label}: neon-pilot --help`);
  assert(help.stdout.includes('Usage: neon-pilot <command> [args]'), `${label}: --help did not print usage.`);

  const commandList = runCli(['commands']);
  assertCliOk(commandList, `${label}: neon-pilot commands`);
  assert(commandList.stdout.startsWith('Neon Pilot commands:'), `${label}: commands did not print human output.`);

  const commandsJson = runCli(['commands', '--json']);
  assertCliOk(commandsJson, `${label}: neon-pilot commands --json`);
  const parsed = parseJson(commandsJson.stdout, `${label}: commands --json`);
  const commands = Array.isArray(parsed?.commands) ? parsed.commands : [];
  assert(commands.length > 0, `${label}: commands --json returned no commands.`);

  const cliStatus = runCli(['cli', 'status']);
  assertCliOk(cliStatus, `${label}: neon-pilot cli status`);
  assert(cliStatus.stdout.includes('Neon Pilot CLI:'), `${label}: cli status did not print human output.`);

  const cliStatusJson = runCli(['cli', 'status', '--json']);
  assertCliOk(cliStatusJson, `${label}: neon-pilot cli status --json`);
  parseJson(cliStatusJson.stdout, `${label}: cli status --json`);

  for (const command of commands) {
    const commandPath = typeof command.command === 'string' ? command.command : '';
    if (!commandPath) continue;
    const commandHelp = runCli(['help', ...commandPath.split(/\s+/)]);
    assertCliOk(commandHelp, `${label}: neon-pilot help ${commandPath}`);
    assert(commandHelp.stdout.includes('Usage: neon-pilot '), `${label}: help for "${commandPath}" did not include usage.`);
  }

  return commands;
}

const manifestCommands = collectManifestCliCommands();
validateManifestCliCommands(manifestCommands);
let lastRuntimeCommands = [];
for (let iteration = 1; iteration <= repeat; iteration += 1) {
  lastRuntimeCommands = smokeCli(iteration);
}
validateRuntimeCommands(lastRuntimeCommands, manifestCommands);

if (failures.length > 0) {
  console.error(`CLI surface check failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`CLI surface check passed: ${lastRuntimeCommands.length} commands, ${manifestCommands.length} manifest commands, repeat=${repeat}.`);
