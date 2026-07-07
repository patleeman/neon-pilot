import { existsSync, type FSWatcher, mkdtempSync, rmSync, watch } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { AuthStorage, type ExtensionAPI, type ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { getRuntimeConfigRoot, writeMergedMcpConfigFile } from '@neon-pilot/core';
import { type DesktopRootLayout, materializeRuntimeResourcesToAgentDir, resolveRuntimeResources } from '@neon-pilot/core';

import { ensureNeonPilotCliLauncher, prependNeonPilotCliBin } from '../cliEnvironment.js';
import { type BashProcessWrapper, clearBashProcessWrappers, registerBashProcessWrapper } from '../conversations/processWrappers.js';
import {
  createManifestAgentExtensions,
  listManifestAgentExtensionCacheEntries,
  resolveManifestAgentLifecycleModelProfile,
} from '../extensions/extensionAgentExtensions.js';
import { listRuntimeExtensionBackendEntries } from '../extensions/extensionRuntimeResources.js';
import { createManifestToolAgentExtensions, listManifestToolAgentExtensionCacheEntries } from '../extensions/manifestToolAgentExtension.js';
import { createPersonaMemoryAgentExtension, setRuntimeAgentHookBuilders } from '../extensions/runtimeAgentHooks.js';
import { readSavedModelPreferences, readSavedModelRef } from '../models/modelPreferences.js';
import { buildInstructionPlan } from '../prompt-assembly/instructionInventory.js';
import { buildPromptTemplatePlan, buildPromptTemplatePlanAsync } from '../prompts/promptTemplateInventory.js';
import { LIVE_SESSION_RESOURCE_OPTIONS_PERF, type LiveSessionResourceOptions } from '../routes/context.js';
import { registerProcessWrapper } from '../shared/processLauncher.js';
import { buildSkillInjectionPlan, buildSkillInjectionPlanAsync } from '../skills/skillInventory.js';

export interface RuntimeStateLogger {
  warn: (message: string, fields?: Record<string, unknown>) => void;
}

export interface CreateRuntimeStateOptions {
  repoRoot: string;
  agentDir: string;
  settingsFile: string;
  stateRoot: string;
  logger: RuntimeStateLogger;
  desktopRootLayout: DesktopRootLayout;
}

export interface RuntimeState {
  getRuntimeScope: () => string;
  materializeRuntimeResources: () => void;
  refreshSkillRuntimeResources: () => void;
  buildLiveSessionExtensionFactories: () => ExtensionFactory[];
  buildLiveSessionResourceOptions: () => LiveSessionResourceOptions;
  buildLiveSessionResourceOptionsAsync: () => Promise<LiveSessionResourceOptions>;
  withTemporaryRuntimeAgentDir: <T>(run: (agentDir: string) => Promise<T>) => Promise<T>;
}

const DEFAULT_RUNTIME_SCOPE = 'shared';
const LIVE_SESSION_HOT_CACHE_TTL_MS = 15_000;
const skillRuntimeResourceRefreshers = new Map<string, () => void>();

function renderExtensionInstructionSupplement(layers: unknown[]): string | undefined {
  const content = layers
    .flatMap((layer): string[] => {
      if (!layer || typeof layer !== 'object' || Array.isArray(layer)) return [];
      const record = layer as Record<string, unknown>;
      const source = record.source;
      const isExtensionSource = Boolean(
        source && typeof source === 'object' && !Array.isArray(source) && (source as Record<string, unknown>).kind === 'extension',
      );
      return isExtensionSource && typeof record.content === 'string' && record.content.trim() ? [record.content.trim()] : [];
    })
    .join('\n\n');
  return content || undefined;
}

function skillRuntimeResourceKey(input: { runtimeScope: string; agentDir: string }): string {
  return `${input.runtimeScope}\n${input.agentDir}`;
}

export function refreshRegisteredSkillRuntimeResources(input: { runtimeScope?: string; runtimeDir: string }): void {
  const key = skillRuntimeResourceKey({ runtimeScope: input.runtimeScope ?? DEFAULT_RUNTIME_SCOPE, agentDir: input.runtimeDir });
  skillRuntimeResourceRefreshers.get(key)?.();
}

export function createRuntimeState(options: CreateRuntimeStateOptions): RuntimeState {
  const { repoRoot, agentDir, settingsFile, stateRoot, logger, desktopRootLayout } = options;
  const runtimeScope = DEFAULT_RUNTIME_SCOPE;
  const mcpConfigWatchers: FSWatcher[] = [];
  let mcpConfigReloadTimer: NodeJS.Timeout | null = null;
  let liveSessionResourceOptionsCache: { key: string; value: LiveSessionResourceOptions; updatedAtMs: number } | null = null;
  let liveSessionResourceOptionsPromiseCache: { key: string; promise: Promise<LiveSessionResourceOptions> } | null = null;
  let liveSessionExtensionFactoriesCache: { key: string; value: ExtensionFactory[]; updatedAtMs: number } | null = null;

  function withResourceOptionsPerf(value: LiveSessionResourceOptions, perf: Record<string, number>): LiveSessionResourceOptions {
    Object.defineProperty(value, LIVE_SESSION_RESOURCE_OPTIONS_PERF, {
      value: perf,
      enumerable: false,
      configurable: true,
    });
    return value;
  }

  function applyRuntimeEnvironment(mcpConfigPath?: string | null): void {
    ensureNeonPilotCliLauncher({ repoRoot, stateRoot });
    process.env.PATH = prependNeonPilotCliBin(process.env, stateRoot).PATH;
    registerProcessWrapper(
      'neon-pilot-cli',
      (context) => ({
        ...context,
        env: prependNeonPilotCliBin(context.env, stateRoot),
      }),
      { label: 'Neon Pilot CLI' },
    );

    delete process.env.NEON_PILOT_ACTIVE_PROFILE;
    delete process.env.NEON_PILOT_PROFILE;
    if (existsSync(resolve(repoRoot, 'packages'))) {
      process.env.NEON_PILOT_REPO_ROOT = repoRoot;
      delete process.env.NEON_PILOT_RESOURCES_ROOT;
    } else {
      delete process.env.NEON_PILOT_REPO_ROOT;
      process.env.NEON_PILOT_RESOURCES_ROOT = repoRoot;
    }

    if (mcpConfigPath) {
      process.env.MCP_CONFIG_PATH = mcpConfigPath;
      return;
    }

    delete process.env.MCP_CONFIG_PATH;
  }

  function writeRuntimeMcpConfig(skillDirs: readonly string[]): void {
    const materializedMcpConfigPath = join(agentDir, 'mcp_servers.json');
    const env = { ...process.env };
    if (env.MCP_CONFIG_PATH === materializedMcpConfigPath) delete env.MCP_CONFIG_PATH;
    const mergedMcpConfig = writeMergedMcpConfigFile({
      outputPath: materializedMcpConfigPath,
      cwd: process.cwd(),
      env,
      skillDirs,
    });
    applyRuntimeEnvironment(mergedMcpConfig.bundledServerCount > 0 ? materializedMcpConfigPath : null);
  }

  function watchRuntimeMcpConfig(skillDirs: readonly string[]): void {
    for (const watcher of mcpConfigWatchers.splice(0)) {
      watcher.close();
    }

    const scheduleReload = () => {
      if (mcpConfigReloadTimer) clearTimeout(mcpConfigReloadTimer);
      mcpConfigReloadTimer = setTimeout(() => {
        try {
          writeRuntimeMcpConfig(skillDirs);
        } catch (error) {
          logger.warn('failed to refresh runtime MCP config', { message: (error as Error).message });
        }
      }, 250);
    };

    const watchDirs = [...new Set(skillDirs.flatMap((dir) => [dir, dirname(dir)]))];
    for (const dir of watchDirs) {
      if (!existsSync(dir)) continue;
      try {
        const watcher = watch(dir, { recursive: true }, (_event, filename) => {
          if (!filename || String(filename).endsWith('mcp.json')) scheduleReload();
        });
        watcher.on('error', (error) => logger.warn('runtime MCP config watcher failed', { dir, message: error.message }));
        mcpConfigWatchers.push(watcher);
      } catch (error) {
        logger.warn('failed to watch runtime MCP config directory', { dir, message: (error as Error).message });
      }
    }
  }

  function materializeRuntimeResources(): void {
    const extensionEntries = listRuntimeExtensionBackendEntries();
    const resolved = resolveRuntimeResources(runtimeScope, {
      repoRoot,
      extensionEntries,
      desktopRootLayout,
    });
    const modelRef = readSavedModelRef(settingsFile);
    const skills = buildSkillInjectionPlan({
      runtimeScope,
      repoRoot,
      desktopRootLayout,
    });
    const promptTemplates = buildPromptTemplatePlan({
      runtimeScope,
      repoRoot,
      modelRef,
      desktopRootLayout,
    });
    liveSessionResourceOptionsCache = {
      key: JSON.stringify({ runtimeScope, modelRef, extensionEntries }),
      updatedAtMs: Date.now(),
      value: withResourceOptionsPerf(
        {
          additionalExtensionPaths: resolved.extensionEntries,
          additionalSkillPaths: skills.skillPaths,
          additionalPromptTemplatePaths: promptTemplates.templatePaths,
          additionalThemePaths: resolved.themeEntries,
        },
        { cacheHit: 0 },
      ),
    };
    materializeRuntimeResourcesToAgentDir(resolved, agentDir);
    writeRuntimeMcpConfig(skills.skillPaths);
    watchRuntimeMcpConfig(skills.skillPaths);
  }

  function refreshSkillRuntimeResources(): void {
    liveSessionResourceOptionsCache = null;
    liveSessionResourceOptionsPromiseCache = null;
    const skills = buildSkillInjectionPlan({
      runtimeScope,
      repoRoot,
      desktopRootLayout,
    });
    writeRuntimeMcpConfig(skills.skillPaths);
    watchRuntimeMcpConfig(skills.skillPaths);
  }

  skillRuntimeResourceRefreshers.set(skillRuntimeResourceKey({ runtimeScope, agentDir }), refreshSkillRuntimeResources);

  setRuntimeAgentHookBuilders({
    buildLiveSessionResourceOptions,
    buildLiveSessionExtensionFactories,
  });

  function getRuntimeScope(): string {
    return runtimeScope;
  }

  function hasOpenAiImageProvider(): boolean {
    try {
      const auth = AuthStorage.create(join(agentDir, 'auth.json'));
      return auth.hasAuth('openai') || auth.hasAuth('openai-codex');
    } catch {
      return false;
    }
  }

  function getPreferredVisionModel(): string {
    return readSavedModelPreferences(settingsFile).currentVisionModel;
  }

  /**
   * Wraps an extension factory to enforce stable runtime boundaries.
   * The system prompt is assembled exclusively from file layers
   * (SYSTEM.md, APPEND_SYSTEM.md, AGENTS.md from CWD). Extensions that
   * need to influence the system prompt should write to those files during
   * setup, not override at runtime.
   *
   * Tool registration is stable for the life of a session. Extensions may use
   * ctx.addActiveTools/removeActiveTools from session_start/model_select
   * handlers for session-scoped model profile behavior; this only mutates the
   * active set over already-registered tools.
   */
  function guardExtensionApi(factory: ExtensionFactory): ExtensionFactory {
    const warnedAmbiguousProfileRefs = new Set<string>();

    function resolveLifecycleModelProfile(ctx: Record<string, unknown>) {
      const model = ctx.model as { provider?: unknown; id?: unknown } | undefined;
      const provider = typeof model?.provider === 'string' ? model.provider : '';
      const modelId = typeof model?.id === 'string' ? model.id : '';
      if (!provider || !modelId) return { kind: 'none' as const, modelRef: null };
      const modelRef = `${provider}/${modelId}`;
      const resolution = resolveManifestAgentLifecycleModelProfile({ provider, model: modelId });
      if (resolution.kind === 'ambiguous' && !warnedAmbiguousProfileRefs.has(modelRef)) {
        warnedAmbiguousProfileRefs.add(modelRef);
        logger.warn('ambiguous model profile match', {
          modelRef,
          profiles: resolution.profiles.map((profile) => `${profile.extensionId}/${profile.id}`),
        });
      }
      return { ...resolution, modelRef };
    }

    return (pi: ExtensionAPI) => {
      const apiWithProcessWrappers = pi as ExtensionAPI & {
        registerBashProcessWrapper?: (id: string, wrap: BashProcessWrapper, options?: { label?: string }) => void;
      };
      apiWithProcessWrappers.registerBashProcessWrapper = registerBashProcessWrapper;

      const guardedPi = new Proxy(apiWithProcessWrappers, {
        get(target, prop, receiver) {
          if (prop === 'setActiveTools' || prop === 'addActiveTools' || prop === 'removeActiveTools') {
            return () => {
              throw new Error(
                'Global active tool mutation is unsupported. Use ctx.addActiveTools/removeActiveTools from session_start or model_select handlers.',
              );
            };
          }
          if (prop === 'on') {
            return (event: string, handler: (...args: unknown[]) => unknown) => {
              const wrapLifecycleContext = (args: unknown[]): unknown[] => {
                if (event !== 'session_start' && event !== 'model_select') return args;
                const ctx = args[1];
                if (!ctx || typeof ctx !== 'object') return args;
                return [
                  args[0],
                  {
                    ...(ctx as Record<string, unknown>),
                    modelProfile: resolveLifecycleModelProfile(ctx as Record<string, unknown>),
                    getActiveTools: () => target.getActiveTools(),
                    setActiveTools: (toolNames: string[]) => target.setActiveTools(toolNames),
                    addActiveTools: (toolNames: string[]) => {
                      const active = new Set(target.getActiveTools());
                      for (const toolName of toolNames) active.add(toolName);
                      target.setActiveTools([...active]);
                    },
                    removeActiveTools: (toolNames: string[]) => {
                      const removed = new Set(toolNames);
                      target.setActiveTools(target.getActiveTools().filter((toolName) => !removed.has(toolName)));
                    },
                  },
                  ...args.slice(2),
                ];
              };
              if (event === 'before_agent_start') {
                const wrappedHandler = async (...args: unknown[]) => {
                  const result = await handler(...args);
                  if (result && typeof result === 'object' && 'systemPrompt' in (result as Record<string, unknown>)) {
                    logger.warn('Extension attempted to override system prompt via before_agent_start — discarded');
                    return undefined;
                  }
                  return result;
                };
                return Reflect.apply(target.on, target, [event, wrappedHandler]);
              }
              return Reflect.apply(target.on, target, [event, (...args: unknown[]) => handler(...wrapLifecycleContext(args))]);
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
      factory(guardedPi);
    };
  }

  function buildLiveSessionExtensionFactories(): ExtensionFactory[] {
    clearBashProcessWrappers();
    if (liveSessionExtensionFactoriesCache && Date.now() - liveSessionExtensionFactoriesCache.updatedAtMs < LIVE_SESSION_HOT_CACHE_TTL_MS) {
      return liveSessionExtensionFactoriesCache.value;
    }

    const extensionEntries = listRuntimeExtensionBackendEntries();
    const modelRef = readSavedModelRef(settingsFile);
    const cacheKey = JSON.stringify({
      runtimeScope,
      repoRoot,
      runtimeConfigRoot: getRuntimeConfigRoot(),
      stateRoot,
      modelRef,
      extensionEntries,
      agentRegistrations: listManifestAgentExtensionCacheEntries(),
      toolRegistrations: listManifestToolAgentExtensionCacheEntries(),
    });
    if (liveSessionExtensionFactoriesCache?.key === cacheKey) {
      liveSessionExtensionFactoriesCache.updatedAtMs = Date.now();
      return liveSessionExtensionFactoriesCache.value;
    }

    const agentExtensions = createManifestAgentExtensions({ onError: logger.warn });

    // Surface agent extension loading errors as session-level diagnostics
    for (const err of agentExtensions.errors) {
      logger.warn('extension agent factory failed to load', {
        extensionId: err.extensionId,
        message: err.message,
      });
    }

    const factories = [
      ...createManifestToolAgentExtensions({
        getRuntimeScope: getRuntimeScope,
        getPreferredVisionModel,
        getCurrentModelRef: () => readSavedModelRef(settingsFile),
        hasOpenAiImageProvider,
        repoRoot,
        runtimeConfigRoot: getRuntimeConfigRoot(),
        stateRoot,
        serverContext: { getRuntimeScope: getRuntimeScope, getSettingsFile: () => settingsFile, getStateRoot: () => stateRoot },
      }),

      createPersonaMemoryAgentExtension(),
      ...agentExtensions.factories,
    ].map(guardExtensionApi);
    liveSessionExtensionFactoriesCache = { key: cacheKey, value: factories, updatedAtMs: Date.now() };
    return factories;
  }

  function buildLiveSessionResourceOptions(): LiveSessionResourceOptions {
    const startedAtMs = performance.now();
    if (liveSessionResourceOptionsCache && Date.now() - liveSessionResourceOptionsCache.updatedAtMs < LIVE_SESSION_HOT_CACHE_TTL_MS) {
      withResourceOptionsPerf(liveSessionResourceOptionsCache.value, {
        cacheHit: 1,
        hotCache: 1,
        totalMs: Math.round(performance.now() - startedAtMs),
      });
      return liveSessionResourceOptionsCache.value;
    }

    const extensionEntries = listRuntimeExtensionBackendEntries();
    const extensionEntriesAtMs = performance.now();
    const modelRef = readSavedModelRef(settingsFile);
    const modelRefAtMs = performance.now();
    const cacheKey = JSON.stringify({ runtimeScope, modelRef, extensionEntries });
    const cacheKeyAtMs = performance.now();
    if (liveSessionResourceOptionsCache?.key === cacheKey) {
      withResourceOptionsPerf(liveSessionResourceOptionsCache.value, {
        cacheHit: 1,
        extensionEntriesMs: Math.round(extensionEntriesAtMs - startedAtMs),
        modelRefMs: Math.round(modelRefAtMs - extensionEntriesAtMs),
        cacheKeyMs: Math.round(cacheKeyAtMs - modelRefAtMs),
        totalMs: Math.round(performance.now() - startedAtMs),
      });
      return liveSessionResourceOptionsCache.value;
    }

    const resolved = resolveRuntimeResources(runtimeScope, {
      repoRoot,
      extensionEntries,
      desktopRootLayout,
    });
    const resourcesAtMs = performance.now();
    materializeRuntimeResourcesToAgentDir(resolved, agentDir);
    const materializeAtMs = performance.now();

    const assemblyContext = {
      runtimeScope,
      repoRoot,
      modelRef,
      desktopRootLayout,
    };
    const skills = buildSkillInjectionPlan(assemblyContext);
    const skillsAtMs = performance.now();
    const promptTemplates = buildPromptTemplatePlan(assemblyContext);
    const promptTemplatesAtMs = performance.now();

    const value = withResourceOptionsPerf(
      {
        additionalExtensionPaths: resolved.extensionEntries,
        additionalSkillPaths: skills.skillPaths,
        additionalPromptTemplatePaths: promptTemplates.templatePaths,
        additionalThemePaths: resolved.themeEntries,
      },
      {
        cacheHit: 0,
        extensionEntriesMs: Math.round(extensionEntriesAtMs - startedAtMs),
        modelRefMs: Math.round(modelRefAtMs - extensionEntriesAtMs),
        cacheKeyMs: Math.round(cacheKeyAtMs - modelRefAtMs),
        resourcesMs: Math.round(resourcesAtMs - cacheKeyAtMs),
        materializeMs: Math.round(materializeAtMs - resourcesAtMs),
        skillsMs: Math.round(skillsAtMs - materializeAtMs),
        promptTemplatesMs: Math.round(promptTemplatesAtMs - skillsAtMs),
        totalMs: Math.round(promptTemplatesAtMs - startedAtMs),
      },
    );
    liveSessionResourceOptionsCache = { key: cacheKey, value, updatedAtMs: Date.now() };
    return value;
  }

  async function buildLiveSessionResourceOptionsAsync(): Promise<LiveSessionResourceOptions> {
    const startedAtMs = performance.now();
    if (liveSessionResourceOptionsCache && Date.now() - liveSessionResourceOptionsCache.updatedAtMs < LIVE_SESSION_HOT_CACHE_TTL_MS) {
      withResourceOptionsPerf(liveSessionResourceOptionsCache.value, {
        cacheHit: 1,
        hotCache: 1,
        totalMs: Math.round(performance.now() - startedAtMs),
      });
      return liveSessionResourceOptionsCache.value;
    }

    const extensionEntries = listRuntimeExtensionBackendEntries();
    const extensionEntriesAtMs = performance.now();
    const modelRef = readSavedModelRef(settingsFile);
    const modelRefAtMs = performance.now();
    const cacheKey = JSON.stringify({ runtimeScope, modelRef, extensionEntries });
    const cacheKeyAtMs = performance.now();
    if (liveSessionResourceOptionsCache?.key === cacheKey) {
      withResourceOptionsPerf(liveSessionResourceOptionsCache.value, {
        cacheHit: 1,
        extensionEntriesMs: Math.round(extensionEntriesAtMs - startedAtMs),
        modelRefMs: Math.round(modelRefAtMs - extensionEntriesAtMs),
        cacheKeyMs: Math.round(cacheKeyAtMs - modelRefAtMs),
        totalMs: Math.round(performance.now() - startedAtMs),
      });
      return liveSessionResourceOptionsCache.value;
    }
    if (liveSessionResourceOptionsPromiseCache?.key === cacheKey) {
      return liveSessionResourceOptionsPromiseCache.promise;
    }

    const promise = (async () => {
      const resolved = resolveRuntimeResources(runtimeScope, {
        repoRoot,
        extensionEntries,
        desktopRootLayout,
      });
      const resourcesAtMs = performance.now();
      materializeRuntimeResourcesToAgentDir(resolved, agentDir);
      const materializeAtMs = performance.now();
      const assemblyContext = {
        runtimeScope,
        repoRoot,
        modelRef,
        desktopRootLayout,
      };
      const skillsPromise = buildSkillInjectionPlanAsync(assemblyContext);
      const skillsDispatchedAtMs = performance.now();
      const promptTemplatesPromise = buildPromptTemplatePlanAsync(assemblyContext);
      const promptTemplatesDispatchedAtMs = performance.now();
      const instructionsPromise = buildInstructionPlan(assemblyContext);
      const instructionsDispatchedAtMs = performance.now();
      const [skills, promptTemplates, instructions] = await Promise.all([skillsPromise, promptTemplatesPromise, instructionsPromise]);
      const plansAtMs = performance.now();
      const systemPromptSupplement = renderExtensionInstructionSupplement(instructions.layers);

      const value = withResourceOptionsPerf(
        {
          additionalExtensionPaths: resolved.extensionEntries,
          additionalSkillPaths: skills.skillPaths,
          additionalPromptTemplatePaths: promptTemplates.templatePaths,
          additionalThemePaths: resolved.themeEntries,
          ...(systemPromptSupplement ? { systemPromptSupplement } : {}),
        },
        {
          cacheHit: 0,
          extensionEntriesMs: Math.round(extensionEntriesAtMs - startedAtMs),
          modelRefMs: Math.round(modelRefAtMs - extensionEntriesAtMs),
          cacheKeyMs: Math.round(cacheKeyAtMs - modelRefAtMs),
          resourcesMs: Math.round(resourcesAtMs - cacheKeyAtMs),
          materializeMs: Math.round(materializeAtMs - resourcesAtMs),
          skillDispatchMs: Math.round(skillsDispatchedAtMs - materializeAtMs),
          promptTemplateDispatchMs: Math.round(promptTemplatesDispatchedAtMs - skillsDispatchedAtMs),
          instructionDispatchMs: Math.round(instructionsDispatchedAtMs - promptTemplatesDispatchedAtMs),
          planWaitMs: Math.round(plansAtMs - instructionsDispatchedAtMs),
          totalMs: Math.round(plansAtMs - startedAtMs),
        },
      );
      liveSessionResourceOptionsCache = { key: cacheKey, value, updatedAtMs: Date.now() };
      return value;
    })();

    liveSessionResourceOptionsPromiseCache = { key: cacheKey, promise };
    try {
      return await promise;
    } finally {
      if (liveSessionResourceOptionsPromiseCache?.promise === promise) {
        liveSessionResourceOptionsPromiseCache = null;
      }
    }
  }

  function withTemporaryRuntimeAgentDir<T>(run: (runtimeAgentDir: string) => Promise<T>): Promise<T> {
    const resolved = resolveRuntimeResources(runtimeScope, {
      repoRoot,
      extensionEntries: listRuntimeExtensionBackendEntries(),
      desktopRootLayout,
    });
    const runtimeAgentDir = mkdtempSync(join(tmpdir(), 'neon-pilot-web-runtime-inspect-'));
    materializeRuntimeResourcesToAgentDir(resolved, runtimeAgentDir);

    return run(runtimeAgentDir).finally(() => {
      rmSync(runtimeAgentDir, { recursive: true, force: true });
    });
  }

  return {
    getRuntimeScope,
    materializeRuntimeResources,
    refreshSkillRuntimeResources,
    buildLiveSessionExtensionFactories,
    buildLiveSessionResourceOptions,
    buildLiveSessionResourceOptionsAsync,
    withTemporaryRuntimeAgentDir,
  };
}
