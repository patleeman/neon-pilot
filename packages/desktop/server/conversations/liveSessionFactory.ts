import {
  AgentSession,
  AuthStorage,
  createAgentSession,
  createBashTool,
  type ExtensionFactory,
  ModelRegistry,
  type SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { resolveChildProcessEnv } from '@neon-pilot/core';

import { getExtensionHostClient } from '../extensions/extensionHostClient.js';
import { readSavedModelPreferences, readSavedModelRef } from '../models/modelPreferences.js';
import { createRuntimeModelRegistry } from '../models/modelRegistry.js';
import { formatProcessLaunchShellCommand, resolveProcessLaunch } from '../shared/processLauncher.js';
import { buildToolInjectionPlanAsync } from '../tools/toolInventory.js';
import { applyConversationModelPreferencesToLiveSession } from './conversationModelPreferences.js';
import { type LiveSessionLoaderOptions, makeLoader } from './liveSessionLoader.js';
import {
  applyLiveSessionServiceTier,
  repairSessionModelProvider,
  resolveConversationPreferenceStateForSession,
} from './liveSessionModels.js';
import { ensureSessionFileExists, patchSessionManagerPersistence, resolveLiveSessionFile } from './liveSessionPersistence.js';

interface ToolPatchableSessionInternals {
  _baseToolRegistry?: Map<string, unknown>;
  _refreshToolRegistry?: (options: { activeToolNames: string[]; includeAllExtensionTools: boolean }) => void;
}

const TOOL_SELECTION_CACHE_TTL_MS = 60_000;
let cachedToolSelection: {
  key: string;
  activeToolNames: string[];
  cachedAtMs: number;
} | null = null;

interface ResolvedModelProfileSessionPolicy {
  activeTools: string[] | null;
  progressiveSkillDiscovery: boolean;
  ds4Profile: boolean;
}

function parseModelRef(modelRef: string): { provider: string; model: string } | null {
  const separator = modelRef.indexOf('/');
  if (separator <= 0 || separator >= modelRef.length - 1) return null;
  return { provider: modelRef.slice(0, separator), model: modelRef.slice(separator + 1) };
}

async function resolveModelProfileSessionPolicy(modelRef: string): Promise<ResolvedModelProfileSessionPolicy> {
  const parsed = parseModelRef(modelRef);
  if (!parsed) return { activeTools: null, progressiveSkillDiscovery: false, ds4Profile: false };
  const profile = await getExtensionHostClient().resolveModelProfile(parsed);
  if (profile.kind !== 'resolved') return { activeTools: null, progressiveSkillDiscovery: false, ds4Profile: false };
  const activeTools = profile.profile.activeTools;
  const ds4Profile = profile.profile.extensionId === 'system-ds4' && profile.profile.id === 'ds4-compatible';
  return {
    activeTools:
      Array.isArray(activeTools) && activeTools.every((tool): tool is string => typeof tool === 'string') && activeTools.length
        ? activeTools
        : null,
    progressiveSkillDiscovery: ds4Profile,
    ds4Profile,
  };
}

export function makeAuth(agentDir: string): AuthStorage {
  return AuthStorage.create(`${agentDir}/auth.json`);
}

export function makeRegistry(auth: AuthStorage, _extensionFactories?: ExtensionFactory[]): ModelRegistry {
  return createRuntimeModelRegistry(auth);
}

function createDesktopConversationSettingsManager(cwd: string, agentDir: string): SettingsManager {
  const settingsManager = SettingsManager.create(cwd, agentDir);

  // pi's OpenAI Codex `auto` transport prefers cached WebSockets. A mid-turn
  // 1006 close happens after tool calls have already run, so the upstream
  // pre-stream SSE fallback cannot safely recover and the user sees a failed
  // turn. Desktop conversations prioritize reliability over cached-WS speed.
  settingsManager.applyOverrides({ transport: 'sse' });

  return settingsManager;
}

function prependPath(env: NodeJS.ProcessEnv, dir: string): NodeJS.ProcessEnv {
  const currentPath = env.PATH ?? '';
  const parts = currentPath.split(path.delimiter).filter(Boolean);
  return {
    ...env,
    PATH: [dir, ...parts.filter((part) => part !== dir)].join(path.delimiter),
  };
}

function ds4CliCandidates(options: LiveSessionLoaderOptions): string[] {
  const candidates = (options.additionalExtensionPaths ?? []).map((extensionPath) => path.join(extensionPath, 'bin'));
  if (process.env.NEON_PILOT_STATE_ROOT) {
    candidates.push(path.join(process.env.NEON_PILOT_STATE_ROOT, 'extensions', 'system-ds4', 'bin'));
  }
  if (process.env.NEON_PILOT_REPO_ROOT) {
    candidates.push(path.join(process.env.NEON_PILOT_REPO_ROOT, 'installable-extensions', 'system-ds4', 'bin'));
  }
  candidates.push(path.join(process.cwd(), 'installable-extensions', 'system-ds4', 'bin'));
  return candidates;
}

function resolveDs4CliBinDir(options: LiveSessionLoaderOptions): string | null {
  return ds4CliCandidates(options).find((candidate) => existsSync(path.join(candidate, 'ds4'))) ?? null;
}

function publishDs4CliToHostPath(cliBinDir: string | null): void {
  if (!cliBinDir) return;
  process.env.PATH = prependPath(process.env, cliBinDir).PATH;
  process.env.DS4_CLI_BIN = path.join(cliBinDir, 'ds4');
}

function patchConversationBashTool(session: AgentSession, cwd: string, conversationId: string, sessionFile?: string, ds4CliBinDir?: string | null): void {
  const patchableSession = session as unknown as ToolPatchableSessionInternals;
  if (!(patchableSession._baseToolRegistry instanceof Map) || typeof patchableSession._refreshToolRegistry !== 'function') {
    return;
  }

  patchableSession._baseToolRegistry.set(
    'bash',
    createBashTool(cwd, {
      commandPrefix: session.settingsManager.getShellCommandPrefix(),
      spawnHook: (context) => {
        const env = resolveChildProcessEnv(
          {
            NEON_PILOT_SOURCE_CONVERSATION_ID: conversationId,
            ...(sessionFile ? { NEON_PILOT_SOURCE_SESSION_FILE: sessionFile } : {}),
          },
          context.env,
        );
        const launchEnv = ds4CliBinDir ? { ...prependPath(env, ds4CliBinDir), DS4_CLI_BIN: path.join(ds4CliBinDir, 'ds4') } : env;
        const launch = resolveProcessLaunch({ command: 'sh', args: ['-lc', context.command], cwd: context.cwd, env: launchEnv });
        return {
          ...context,
          command: formatProcessLaunchShellCommand(launch),
          env: launch.env,
        };
      },
    }),
  );

  patchableSession._refreshToolRegistry({
    activeToolNames: session.getActiveToolNames(),
    includeAllExtensionTools: true,
  });
}

export async function warmLiveSessionToolSelection(settingsFile: string): Promise<string[]> {
  const profile = process.env.PERSONAL_AGENT_ACTIVE_PROFILE || process.env.PERSONAL_AGENT_PROFILE || 'shared';
  const repoRoot = process.env.PERSONAL_AGENT_REPO_ROOT || process.cwd();
  const modelRef = readSavedModelRef(settingsFile);
  const cacheKey = JSON.stringify({ profile, repoRoot, modelRef });
  const nowMs = Date.now();
  let extensionToolNames =
    cachedToolSelection?.key === cacheKey && nowMs - cachedToolSelection.cachedAtMs <= TOOL_SELECTION_CACHE_TTL_MS
      ? cachedToolSelection.activeToolNames
      : null;
  if (!extensionToolNames) {
    const plan = await buildToolInjectionPlanAsync({ profile, repoRoot, modelRef });
    extensionToolNames = plan.activeToolNames;
    cachedToolSelection = { key: cacheKey, activeToolNames: extensionToolNames, cachedAtMs: nowMs };
  }
  return extensionToolNames;
}

async function applyExtensionToolSelection(session: AgentSession, settingsFile: string): Promise<void> {
  const patchable = session as unknown as { setActiveTools?: (toolNames: string[]) => void; getActiveToolNames?: () => string[] };
  if (typeof patchable.setActiveTools !== 'function') return;

  const extensionToolNames = await warmLiveSessionToolSelection(settingsFile);
  const currentToolNames = patchable.getActiveToolNames?.() ?? [];
  if (currentToolNames.length === 1 && extensionToolNames.includes(currentToolNames[0] ?? '')) {
    return;
  }
  const activeToolNames = [...new Set([...currentToolNames, ...extensionToolNames])];
  patchable.setActiveTools(activeToolNames);
}

export async function createPreparedLiveAgentSession(input: {
  cwd: string;
  agentDir: string;
  settingsFile: string;
  sessionManager: SessionManager;
  options?: LiveSessionLoaderOptions;
  applyInitialPreferences?: boolean;
  ensureSessionFile?: boolean;
}): Promise<{ session: AgentSession; modelRegistry: ModelRegistry; perf?: Record<string, number> }> {
  const startedAtMs = performance.now();
  const options = input.options ?? {};
  const agentDir = options.agentDir ?? input.agentDir;
  const auth = makeAuth(agentDir);
  const authAtMs = performance.now();
  const modelRegistry = makeRegistry(auth, options.extensionFactories);
  const registryAtMs = performance.now();
  const settingsManager = createDesktopConversationSettingsManager(input.cwd, agentDir);
  const settingsAtMs = performance.now();
  const modelProfilePolicy = await resolveModelProfileSessionPolicy(readSavedModelRef(input.settingsFile, modelRegistry.getAvailable()));
  const ds4CliBinDir = modelProfilePolicy.ds4Profile ? resolveDs4CliBinDir(options) : null;
  publishDs4CliToHostPath(ds4CliBinDir);
  const resourceLoader = await makeLoader(
    input.cwd,
    modelProfilePolicy.progressiveSkillDiscovery
      ? {
          ...options,
          additionalSkillPaths: [],
          noSkills: true,
          progressiveDisclosure: true,
          skillDiscoveryPaths: options.additionalSkillPaths ?? [],
        }
      : options,
  );
  const loaderAtMs = performance.now();
  const { session } = await createAgentSession({
    cwd: input.cwd,
    agentDir,
    authStorage: auth,
    modelRegistry,
    resourceLoader,
    sessionManager: input.sessionManager,
    settingsManager,
    ...(modelProfilePolicy.activeTools ?? options.allowedToolNames ? { tools: modelProfilePolicy.activeTools ?? options.allowedToolNames } : {}),
  });
  const agentSessionAtMs = performance.now();

  patchConversationBashTool(session, input.cwd, session.sessionId, resolveLiveSessionFile(session), ds4CliBinDir);
  patchSessionManagerPersistence(session.sessionManager);
  if (input.ensureSessionFile !== false) {
    ensureSessionFileExists(session.sessionManager);
  }
  const persistenceAtMs = performance.now();

  const availableModels = modelRegistry.getAvailable();
  await repairSessionModelProvider(session, availableModels);
  const modelRepairAtMs = performance.now();

  if (
    input.applyInitialPreferences &&
    (options.initialModel !== undefined || options.initialThinkingLevel !== undefined || options.initialServiceTier !== undefined)
  ) {
    await applyConversationModelPreferencesToLiveSession(
      session,
      {
        ...(options.initialModel !== undefined ? { model: options.initialModel } : {}),
        ...(options.initialThinkingLevel !== undefined ? { thinkingLevel: options.initialThinkingLevel } : {}),
        ...(options.initialServiceTier !== undefined ? { serviceTier: options.initialServiceTier } : {}),
      },
      {
        currentModel: session.model?.id ?? '',
        currentThinkingLevel: session.thinkingLevel ?? '',
        currentServiceTier: readSavedModelPreferences(input.settingsFile, availableModels).currentServiceTier,
      },
      availableModels,
    );
  }

  applyLiveSessionServiceTier(
    session,
    resolveConversationPreferenceStateForSession(input.settingsFile, session.sessionManager, availableModels).currentServiceTier,
  );

  if (!modelProfilePolicy.activeTools) {
    await applyExtensionToolSelection(session, input.settingsFile);
  }
  const doneAtMs = performance.now();

  return {
    session,
    modelRegistry,
    perf: {
      authMs: Math.round(authAtMs - startedAtMs),
      registryMs: Math.round(registryAtMs - authAtMs),
      settingsMs: Math.round(settingsAtMs - registryAtMs),
      loaderMs: Math.round(loaderAtMs - settingsAtMs),
      createAgentSessionMs: Math.round(agentSessionAtMs - loaderAtMs),
      persistenceMs: Math.round(persistenceAtMs - agentSessionAtMs),
      modelRepairMs: Math.round(modelRepairAtMs - persistenceAtMs),
      preferencesAndToolsMs: Math.round(doneAtMs - modelRepairAtMs),
      totalMs: Math.round(doneAtMs - startedAtMs),
    },
  };
}
