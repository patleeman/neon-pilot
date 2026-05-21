import { existsSync, type FSWatcher, mkdtempSync, rmSync, watch } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { AuthStorage, type ExtensionAPI, type ExtensionFactory } from '@earendil-works/pi-coding-agent';
import { getRuntimeConfigRoot, getStateRoot, writeMergedMcpConfigFile } from '@neon-pilot/core';
import { materializeRuntimeResourcesToAgentDir, resolveRuntimeResources } from '@neon-pilot/core';

import { type BashProcessWrapper, clearBashProcessWrappers, registerBashProcessWrapper } from '../conversations/processWrappers.js';
import { createManifestAgentExtensions } from '../extensions/extensionAgentExtensions.js';
import { isExtensionEnabled, listExtensionEntries, resolveExtensionModelProfile } from '../extensions/extensionRegistry.js';
import { createManifestToolAgentExtensions } from '../extensions/manifestToolAgentExtension.js';
import { setRuntimeAgentHookBuilders } from '../extensions/runtimeAgentHooks.js';
import { readSavedModelPreferences, readSavedModelRef } from '../models/modelPreferences.js';
import { buildPromptAssemblyPlan, buildPromptAssemblyPlanAsync } from '../prompt-assembly/promptAssembly.js';
import type { LiveSessionResourceOptions } from '../routes/context.js';
import { DEFAULT_RUNTIME_SETTINGS_FILE } from '../ui/settingsPersistence.js';

export interface RuntimeStateLogger {
  warn: (message: string, fields?: Record<string, unknown>) => void;
}

export interface CreateRuntimeStateOptions {
  repoRoot: string;
  agentDir: string;
  logger: RuntimeStateLogger;
}

export interface RuntimeState {
  getRuntimeScope: () => string;
  materializeRuntimeResources: () => void;
  buildLiveSessionExtensionFactories: () => ExtensionFactory[];
  buildLiveSessionResourceOptions: () => LiveSessionResourceOptions;
  buildLiveSessionResourceOptionsAsync: () => Promise<LiveSessionResourceOptions>;
  withTemporaryRuntimeAgentDir: <T>(run: (agentDir: string) => Promise<T>) => Promise<T>;
}

const DEFAULT_RUNTIME_SCOPE = 'shared';

export function createRuntimeState(options: CreateRuntimeStateOptions): RuntimeState {
  const { repoRoot, agentDir, logger } = options;
  const runtimeScope = DEFAULT_RUNTIME_SCOPE;
  const mcpConfigWatchers: FSWatcher[] = [];
  let mcpConfigReloadTimer: NodeJS.Timeout | null = null;

  function applyRuntimeEnvironment(mcpConfigPath?: string | null): void {
    process.env.NEON_PILOT_RUNTIME_SCOPE = runtimeScope;
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

  function resolveRuntimeExtensionEntries(): string[] {
    return listExtensionEntries()
      .filter((entry) => {
        if (entry.source !== 'system') return true;
        return isExtensionEnabled(entry.manifest.id);
      })
      .flatMap((entry) => {
        const backend = entry.manifest.backend?.entry;
        if (!backend) return [];
        return entry.packageRoot ? [join(entry.packageRoot, backend)] : [];
      });
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
    const resolved = resolveRuntimeResources(runtimeScope, {
      repoRoot,
      extensionEntries: resolveRuntimeExtensionEntries(),
    });
    const assembly = buildPromptAssemblyPlan({
      runtimeScope,
      repoRoot,
      modelRef: readSavedModelRef(DEFAULT_RUNTIME_SETTINGS_FILE),
    });
    materializeRuntimeResourcesToAgentDir(resolved, agentDir);
    writeRuntimeMcpConfig(assembly.skills.skillPaths);
    watchRuntimeMcpConfig(assembly.skills.skillPaths);
  }

  setRuntimeAgentHookBuilders({
    buildLiveSessionResourceOptions,
    buildLiveSessionExtensionFactories,
  });

  try {
    materializeRuntimeResources();
  } catch (error) {
    logger.warn('failed to materialize runtime resources', {
      runtimeScope,
      message: (error as Error).message,
    });
  }

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
    return readSavedModelPreferences(DEFAULT_RUNTIME_SETTINGS_FILE).currentVisionModel;
  }

  /**
   * Wraps an extension factory to enforce stable runtime boundaries.
   * The system prompt is assembled exclusively from file layers
   * (SYSTEM.md, APPEND_SYSTEM.md, AGENTS.md from CWD). Extensions that
   * need to influence the system prompt should write to those files during
   * setup, not override at runtime.
   *
   * Tool registration is stable for the life of a session. Extensions may use
   * ctx.setActiveTools from session_start/model_select handlers for
   * session-scoped model profile behavior; this only changes the active
   * allowlist over already-registered tools.
   */
  function guardExtensionApi(factory: ExtensionFactory): ExtensionFactory {
    const warnedAmbiguousProfileRefs = new Set<string>();

    function resolveLifecycleModelProfile(ctx: Record<string, unknown>) {
      const model = ctx.model as { provider?: unknown; id?: unknown } | undefined;
      const provider = typeof model?.provider === 'string' ? model.provider : '';
      const modelId = typeof model?.id === 'string' ? model.id : '';
      if (!provider || !modelId) return { kind: 'none' as const, modelRef: null };
      const modelRef = `${provider}/${modelId}`;
      const resolution = resolveExtensionModelProfile({ provider, model: modelId });
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
          if (prop === 'setActiveTools') {
            return () => {
              throw new Error('pi.setActiveTools is unsupported. Use ctx.setActiveTools from session_start or model_select handlers.');
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
    const agentExtensions = createManifestAgentExtensions({ onError: logger.warn });

    // Surface agent extension loading errors as session-level diagnostics
    for (const err of agentExtensions.errors) {
      logger.warn('extension agent factory failed to load', {
        extensionId: err.extensionId,
        message: err.message,
      });
    }

    // TODO: Remove this stub once the unified error display is wired up.
    // This simulates what a real extension loading error looks like through
    // the diagnostics pipeline. Replace with actual extension load-error
    // collection from the resource loader's extensionsResult.errors.
    {
      const stubErrors = [
        {
          extensionId: 'system-conversation-tools',
          message: 'Backend build failed — source files not found in bundled app (stub)',
        },
      ];
      for (const err of stubErrors) {
        logger.warn('extension load error', err);
      }
    }

    return [
      ...createManifestToolAgentExtensions({
        getRuntimeScope: getRuntimeScope,
        getPreferredVisionModel,
        getCurrentModelRef: () => readSavedModelRef(DEFAULT_RUNTIME_SETTINGS_FILE),
        hasOpenAiImageProvider,
        repoRoot,
        runtimeConfigRoot: getRuntimeConfigRoot(),
        stateRoot: getStateRoot(),
        serverContext: { getRuntimeScope: getRuntimeScope },
      }),

      ...agentExtensions.factories,
    ].map(guardExtensionApi);
  }

  function buildLiveSessionResourceOptions(): LiveSessionResourceOptions {
    const resolved = resolveRuntimeResources(runtimeScope, {
      repoRoot,
      extensionEntries: resolveRuntimeExtensionEntries(),
    });

    const assembly = buildPromptAssemblyPlan({
      runtimeScope,
      repoRoot,
      modelRef: readSavedModelRef(DEFAULT_RUNTIME_SETTINGS_FILE),
    });

    return {
      additionalExtensionPaths: resolved.extensionEntries,
      additionalSkillPaths: assembly.skills.skillPaths,
      additionalPromptTemplatePaths: assembly.promptTemplates.templatePaths,
      additionalThemePaths: resolved.themeEntries,
    };
  }

  async function buildLiveSessionResourceOptionsAsync(): Promise<LiveSessionResourceOptions> {
    const resolved = resolveRuntimeResources(runtimeScope, {
      repoRoot,
      extensionEntries: resolveRuntimeExtensionEntries(),
    });
    const assembly = await buildPromptAssemblyPlanAsync({
      runtimeScope,
      repoRoot,
      modelRef: readSavedModelRef(DEFAULT_RUNTIME_SETTINGS_FILE),
    });

    return {
      additionalExtensionPaths: resolved.extensionEntries,
      additionalSkillPaths: assembly.skills.skillPaths,
      additionalPromptTemplatePaths: assembly.promptTemplates.templatePaths,
      additionalThemePaths: resolved.themeEntries,
    };
  }

  function withTemporaryRuntimeAgentDir<T>(run: (runtimeAgentDir: string) => Promise<T>): Promise<T> {
    const resolved = resolveRuntimeResources(runtimeScope, {
      repoRoot,
      extensionEntries: resolveRuntimeExtensionEntries(),
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
    buildLiveSessionExtensionFactories,
    buildLiveSessionResourceOptions,
    buildLiveSessionResourceOptionsAsync,
    withTemporaryRuntimeAgentDir,
  };
}
