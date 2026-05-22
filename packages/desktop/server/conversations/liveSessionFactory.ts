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
import { resolveChildProcessEnv } from '@neon-pilot/core';

import { readSavedModelPreferences, readSavedModelRef } from '../models/modelPreferences.js';
import { createRuntimeModelRegistry } from '../models/modelRegistry.js';
import { formatProcessLaunchShellCommand, resolveProcessLaunch } from '../shared/processLauncher.js';
import { buildToolInjectionPlan } from '../tools/toolInventory.js';
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

function patchConversationBashTool(session: AgentSession, cwd: string, conversationId: string, sessionFile?: string): void {
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
        const launch = resolveProcessLaunch({ command: 'sh', args: ['-lc', context.command], cwd: context.cwd, env });
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

function applyExtensionToolSelection(session: AgentSession, settingsFile: string): void {
  const patchable = session as unknown as { setActiveTools?: (toolNames: string[]) => void; getActiveToolNames?: () => string[] };
  if (typeof patchable.setActiveTools !== 'function') return;

  const plan = buildToolInjectionPlan({
    profile: process.env.PERSONAL_AGENT_ACTIVE_PROFILE || process.env.PERSONAL_AGENT_PROFILE || 'shared',
    repoRoot: process.env.PERSONAL_AGENT_REPO_ROOT || process.cwd(),
    modelRef: readSavedModelRef(settingsFile),
  });
  const activeToolNames = [...new Set([...(patchable.getActiveToolNames?.() ?? []), ...plan.activeToolNames])];
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
  const resourceLoader = await makeLoader(input.cwd, options);
  const loaderAtMs = performance.now();
  const { session } = await createAgentSession({
    cwd: input.cwd,
    agentDir,
    authStorage: auth,
    modelRegistry,
    resourceLoader,
    sessionManager: input.sessionManager,
    settingsManager,
    ...(options.allowedToolNames ? { tools: options.allowedToolNames } : {}),
  });
  const agentSessionAtMs = performance.now();

  patchConversationBashTool(session, input.cwd, session.sessionId, resolveLiveSessionFile(session));
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

  applyExtensionToolSelection(session, input.settingsFile);
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
