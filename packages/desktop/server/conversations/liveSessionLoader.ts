import { resolve } from 'node:path';

import { DefaultResourceLoader, type ExtensionFactory } from '@earendil-works/pi-coding-agent';
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

function buildDs4SystemPrompt(skillPaths: string[]): string {
  const skillLines = normalizeLiveSessionLoaderPaths(skillPaths).map((path) => `- ${path}`);
  return `${NEON_LIVE_SESSION_SYSTEM_PROMPT}

DS4 local model mode:
- Core tools are stable: bash, read, and edit.
- If DS4 RTK shell compression is enabled in settings, simple supported bash commands are automatically run through RTK for compact output.
- Use bash to discover and run extended capabilities through the DS4 CLI.
- Start with \`ds4 help\` when you need CLI capabilities.
- Useful CLI commands include \`ds4 list\`, \`ds4 search\`, \`ds4 read\`, \`ds4 write\`, \`ds4 edit\`, and \`ds4 fetch\`.
- Prefer direct shell commands when they are shorter or more precise, such as \`rg\`, \`git status --short\`, and focused test commands.
- Skills are pointers only in DS4 mode. Search these skill files first when the task may match a workflow, then read the matching SKILL.md before using it:
${skillLines.length > 0 ? skillLines.join('\n') : '- No extension skill paths were provided for this session.'}`;
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
  return `${label}: ${filePath}

For DS4, this file is a pointer only. Read it only when the task depends on these preferences.`;
}

function renderAppendSystemPointer(filePath: string): string {
  return `Global user agent defaults: ${filePath}

For DS4, this file is a pointer only. Read it only when the task depends on global user defaults.`;
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
      ? buildDs4SystemPrompt(options.skillDiscoveryPaths ?? options.additionalSkillPaths ?? [])
      : NEON_LIVE_SESSION_SYSTEM_PROMPT,
    noSkills: options.noSkills,
    noThemes: true,
    ...(options.progressiveDisclosure
      ? {
          appendSystemPromptOverride: (base: string[]) => base.map((_content, index) => renderAppendSystemPointer(resolve(agentDir, 'APPEND_SYSTEM.md'))),
          agentsFilesOverride: (base: { agentsFiles: Array<{ path: string; content: string }> }) => ({
            agentsFiles: base.agentsFiles.map((file) => ({
              ...file,
              content: renderAgentsPointerContent(file.path, agentDir),
            })),
          }),
        }
      : {}),
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
