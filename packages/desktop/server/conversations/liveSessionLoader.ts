import { resolve } from 'node:path';

import { DefaultResourceLoader, type ExtensionFactory, loadProjectContextFiles } from '@earendil-works/pi-coding-agent';
import { getPiAgentRuntimeDir } from '@neon-pilot/core';

import { logWarn } from '../shared/logging.js';

const AGENT_DIR = getPiAgentRuntimeDir();
const PREWARMED_LIVE_SESSION_LOADERS_MAX = 4;
const PREWARMED_LIVE_SESSION_LOADERS_TTL_MS = 10 * 60_000;
const NEON_LIVE_SESSION_SYSTEM_PROMPT = `You are an expert coding assistant operating inside Neon Pilot, Patrick Lee's extension-based agent runtime.

Help users by reading files, running commands, editing code, and writing new files.

Guidelines:
- Be concise in your responses.
- Show file paths clearly when working with files.
- Use available tools deliberately and prefer small, verifiable changes.
- Load only relevant knowledge: AGENTS.md for standing context, skills for procedures, notes/projects for reference.
- When a task matches an available skill, read that SKILL.md before using the workflow.`;

function buildNeonSystemPrompt(input: { cwd: string; agentDir: string }): string {
  return `${NEON_LIVE_SESSION_SYSTEM_PROMPT}${renderAgentsFiles(input.cwd, input.agentDir)}`;
}

function buildDs4SystemPrompt(input: { cwd: string; agentDir: string; skillPaths: string[] }): string {
  const agentsPointers = renderAgentsPointers(input.cwd, input.agentDir);
  void input.skillPaths;
  return `You are an expert coding assistant inside Neon Pilot.

Guidelines:
- Be concise, direct, and verify real behavior before calling work done.
- Use available tools deliberately; prefer small, precise file reads, edits, and tests.
- Load context progressively: AGENTS.md for standing instructions, skills for procedures, notes/project files for reference.

DS4 mode:
- This prompt is intentionally terse; rely on progressive disclosure instead of memorizing everything up front.
- Only the shown tools are directly available. Use bash to explore and invoke withheld system tools through the \`ds4\` CLI; start with \`ds4 help\` and \`ds4 tools\`.
- The read tool uses compact \`line|text\` output; line numbers are references, not file content. For large edits, the edit tool supports one \`[upto]\` marker between unique head and tail anchors.
- DS4 bash compacts eligible shell output with RTK by default when RTK is installed. Use \`ds4 compression off\` to disable it, and \`ds4 compression rtk\` to re-enable it.
- Skills are progressively loaded too. Use \`ds4 skills list\`, \`ds4 skills search <query>\`, and \`ds4 skills get <id-or-query>\` before applying a workflow.${agentsPointers}`;
}

function labelAgentsFile(filePath: string, agentDir: string): string {
  const normalizedPath = resolve(filePath);
  const normalizedAgentDir = resolve(agentDir);
  if (normalizedPath === resolve(normalizedAgentDir, 'AGENTS.md') || normalizedPath.startsWith(`${normalizedAgentDir}/`)) {
    return 'Global user agent preferences';
  }
  return 'Repo user agent preferences';
}

function renderAgentsPointerContent(filePath: string, agentDir: string): string {
  const label = labelAgentsFile(filePath, agentDir);
  return `${label}: ${filePath} (pointer only; read if relevant)`;
}

function renderAgentsPointers(cwd: string, agentDir: string): string {
  const files = loadProjectContextFiles({ cwd, agentDir });
  if (files.length === 0) return '';
  return ['', '', 'Instruction files:', ...files.map((file) => `- ${renderAgentsPointerContent(file.path, agentDir)}`)].join('\n');
}

function renderAgentsFiles(cwd: string, agentDir: string): string {
  const files = loadProjectContextFiles({ cwd, agentDir });
  if (files.length === 0) return '';
  return [
    '',
    '',
    'Instruction files:',
    ...files.map((file) => {
      const label = labelAgentsFile(file.path, agentDir);
      return [`## ${label}`, `Path: ${file.path}`, '', file.content.trim()].filter(Boolean).join('\n');
    }),
  ].join('\n\n');
}

export interface LiveSessionLoaderOptions {
  agentDir?: string;
  extensionFactories?: ExtensionFactory[];
  additionalExtensionPaths?: string[];
  additionalSkillPaths?: string[];
  additionalPromptTemplatePaths?: string[];
  additionalThemePaths?: string[];
  initialModel?: string | null;
  initialThinkingLevel?: string | null;
  initialServiceTier?: string | null;
  /** When set, only these tool names are exposed to the agent session. */
  allowedToolNames?: string[];
  /** When set, skills are not loaded into the prompt up front. */
  noSkills?: boolean;
  /** When set, AGENTS.md and skills are disclosed as pointers for local DS4 sessions. */
  progressiveDisclosure?: boolean;
  skillDiscoveryPaths?: string[];
}

interface PrewarmedLiveSessionLoaderEntry {
  loader: DefaultResourceLoader;
  warmedAtMs: number;
}

const prewarmedLiveSessionLoaders = new Map<string, PrewarmedLiveSessionLoaderEntry>();
const inflightLiveSessionLoaderWarmups = new Map<string, Promise<DefaultResourceLoader>>();

function normalizeLiveSessionLoaderPaths(paths: string[] | undefined): string[] {
  return [...new Set((paths ?? []).map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function buildLiveSessionLoaderCacheKey(cwd: string, options: LiveSessionLoaderOptions = {}): string {
  return JSON.stringify({
    cwd,
    agentDir: options.agentDir ?? AGENT_DIR,
    extensionFactories: (options.extensionFactories ?? []).map((factory, index) => factory.name || `factory-${String(index)}`),
    additionalExtensionPaths: normalizeLiveSessionLoaderPaths(options.additionalExtensionPaths),
    additionalSkillPaths: normalizeLiveSessionLoaderPaths(options.additionalSkillPaths),
    additionalPromptTemplatePaths: normalizeLiveSessionLoaderPaths(options.additionalPromptTemplatePaths),
    additionalThemePaths: normalizeLiveSessionLoaderPaths(options.additionalThemePaths),
    noSkills: options.noSkills ?? false,
    progressiveDisclosure: options.progressiveDisclosure ?? false,
    skillDiscoveryPaths: normalizeLiveSessionLoaderPaths(options.skillDiscoveryPaths),
  });
}

function createLiveSessionLoader(cwd: string, options: LiveSessionLoaderOptions = {}): DefaultResourceLoader {
  const agentDir = options.agentDir ?? AGENT_DIR;
  return new DefaultResourceLoader({
    cwd,
    agentDir,
    extensionFactories: options.extensionFactories,
    additionalExtensionPaths: options.additionalExtensionPaths,
    additionalSkillPaths: options.additionalSkillPaths,
    additionalPromptTemplatePaths: options.additionalPromptTemplatePaths,
    additionalThemePaths: options.additionalThemePaths,
    systemPrompt: options.progressiveDisclosure
      ? buildDs4SystemPrompt({
          cwd,
          agentDir,
          skillPaths: options.skillDiscoveryPaths ?? options.additionalSkillPaths ?? [],
        })
      : buildNeonSystemPrompt({ cwd, agentDir }),
    noSkills: options.noSkills,
    noThemes: true,
    noContextFiles: true,
  });
}

function trimPrewarmedLiveSessionLoaders(): void {
  while (prewarmedLiveSessionLoaders.size > PREWARMED_LIVE_SESSION_LOADERS_MAX) {
    const oldestKey = prewarmedLiveSessionLoaders.keys().next().value;
    if (!oldestKey) {
      break;
    }

    prewarmedLiveSessionLoaders.delete(oldestKey);
  }
}

function readPrewarmedLiveSessionLoader(cacheKey: string): DefaultResourceLoader | undefined {
  const cached = prewarmedLiveSessionLoaders.get(cacheKey);
  if (!cached) {
    return undefined;
  }

  if (Date.now() - cached.warmedAtMs > PREWARMED_LIVE_SESSION_LOADERS_TTL_MS) {
    prewarmedLiveSessionLoaders.delete(cacheKey);
    return undefined;
  }

  prewarmedLiveSessionLoaders.delete(cacheKey);
  return cached.loader;
}

async function loadLiveSessionLoaderFresh(cwd: string, options: LiveSessionLoaderOptions = {}): Promise<DefaultResourceLoader> {
  const loader = createLiveSessionLoader(cwd, options);
  await loader.reload();
  return loader;
}

export function clearPrewarmedLiveSessionLoaders(): void {
  prewarmedLiveSessionLoaders.clear();
  inflightLiveSessionLoaderWarmups.clear();
}

export async function prewarmLiveSessionLoader(cwd: string, options: LiveSessionLoaderOptions = {}): Promise<void> {
  const cacheKey = buildLiveSessionLoaderCacheKey(cwd, options);
  const cached = prewarmedLiveSessionLoaders.get(cacheKey);
  if (cached && Date.now() - cached.warmedAtMs <= PREWARMED_LIVE_SESSION_LOADERS_TTL_MS) {
    return;
  }

  const inflight = inflightLiveSessionLoaderWarmups.get(cacheKey);
  if (inflight) {
    await inflight;
    return;
  }

  const warmup = loadLiveSessionLoaderFresh(cwd, options)
    .then((loader) => {
      prewarmedLiveSessionLoaders.delete(cacheKey);
      prewarmedLiveSessionLoaders.set(cacheKey, {
        loader,
        warmedAtMs: Date.now(),
      });
      trimPrewarmedLiveSessionLoaders();
      return loader;
    })
    .finally(() => {
      inflightLiveSessionLoaderWarmups.delete(cacheKey);
    });

  inflightLiveSessionLoaderWarmups.set(cacheKey, warmup);
  await warmup;
}

export function queuePrewarmLiveSessionLoader(cwd: string, options: LiveSessionLoaderOptions = {}): void {
  void prewarmLiveSessionLoader(cwd, options).catch((error) => {
    logWarn('live session loader prewarm failed', {
      cwd,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  });
}

export async function makeLoader(cwd: string, options: LiveSessionLoaderOptions = {}): Promise<DefaultResourceLoader> {
  const cacheKey = buildLiveSessionLoaderCacheKey(cwd, options);
  const prewarmed = readPrewarmedLiveSessionLoader(cacheKey);
  if (prewarmed) {
    return prewarmed;
  }

  const inflight = inflightLiveSessionLoaderWarmups.get(cacheKey);
  if (inflight) {
    const warmed = await inflight;
    return readPrewarmedLiveSessionLoader(cacheKey) ?? warmed;
  }

  return loadLiveSessionLoaderFresh(cwd, options);
}
