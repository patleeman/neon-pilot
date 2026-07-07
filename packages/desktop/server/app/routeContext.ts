import type { DesktopRootLayout } from '@neon-pilot/core';
import { getRuntimeConfigRoot, resolveDesktopRootLayout } from '@neon-pilot/core';

import type {
  MemoryDocSummary,
  ProfileAgentItemSummary,
  RuntimeScopeTaskSummary,
  ServerRouteContext,
  SkillSummary,
} from '../routes/context.js';

interface CreateServerRouteContextOptions {
  repoRoot: string;
  settingsFile: string;
  authFile: string;
  getRuntimeScope: () => string;
  materializeWebRuntimeConfig: (profile: string) => void;
  getStateRoot: () => string;
  serverPort: number;
  getDefaultWebCwd: () => string;
  resolveRequestedCwd: (cwd: string | null | undefined, defaultCwd?: string) => string | undefined;
  getDesktopRootLayout?: () => DesktopRootLayout;
  publishDesktopAppEvent?: ServerRouteContext['publishDesktopAppEvent'];
  buildLiveSessionResourceOptions: ServerRouteContext['buildLiveSessionResourceOptions'];
  buildLiveSessionResourceOptionsAsync?: ServerRouteContext['buildLiveSessionResourceOptionsAsync'];
  buildLiveSessionExtensionFactories: ServerRouteContext['buildLiveSessionExtensionFactories'];
  flushLiveDeferredResumes: () => Promise<void>;
  getSavedUiPreferences: ServerRouteContext['getSavedUiPreferences'];
  listTasksForRuntimeScope: () => RuntimeScopeTaskSummary[];
  listMemoryDocs: () => MemoryDocSummary[];
  listSkillsForRuntimeScope: () => SkillSummary[];
  listProfileAgentItems: () => ProfileAgentItemSummary[];
  withTemporaryRuntimeAgentDir: ServerRouteContext['withTemporaryRuntimeAgentDir'];
  getDurableRunSnapshot: ServerRouteContext['getDurableRunSnapshot'];
}

export function createServerRouteContext(options: CreateServerRouteContextOptions): ServerRouteContext {
  return {
    getRuntimeScope: options.getRuntimeScope,
    getRepoRoot: () => options.repoRoot,
    getRuntimeConfigRoot,
    materializeWebRuntimeConfig: options.materializeWebRuntimeConfig,
    getSettingsFile: () => options.settingsFile,
    getAuthFile: () => options.authFile,
    getStateRoot: options.getStateRoot,
    getServerPort: () => options.serverPort,
    getDefaultWebCwd: options.getDefaultWebCwd,
    resolveRequestedCwd: options.resolveRequestedCwd,
    getDesktopRootLayout: options.getDesktopRootLayout ?? resolveDesktopRootLayout,
    publishDesktopAppEvent: options.publishDesktopAppEvent ?? (async () => ({ ok: true })),
    buildLiveSessionResourceOptions: options.buildLiveSessionResourceOptions,
    ...(options.buildLiveSessionResourceOptionsAsync
      ? { buildLiveSessionResourceOptionsAsync: options.buildLiveSessionResourceOptionsAsync }
      : {}),
    buildLiveSessionExtensionFactories: options.buildLiveSessionExtensionFactories,
    flushLiveDeferredResumes: options.flushLiveDeferredResumes,
    getSavedUiPreferences: options.getSavedUiPreferences,
    listTasksForRuntimeScope: options.listTasksForRuntimeScope,
    listMemoryDocs: options.listMemoryDocs,
    listSkillsForRuntimeScope: options.listSkillsForRuntimeScope,
    listProfileAgentItems: options.listProfileAgentItems,
    withTemporaryRuntimeAgentDir: options.withTemporaryRuntimeAgentDir,
    getDurableRunSnapshot: options.getDurableRunSnapshot,
  };
}
