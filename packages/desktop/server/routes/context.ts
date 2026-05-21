import type { ExtensionFactory } from '@earendil-works/pi-coding-agent';
import type { Express } from 'express';

import type { SavedUiPreferences } from '../ui/uiPreferences.js';

export interface LiveSessionResourceOptions extends Record<string, unknown> {
  additionalExtensionPaths: string[];
  additionalSkillPaths: string[];
  additionalPromptTemplatePaths: string[];
  additionalThemePaths: string[];
}

export interface RuntimeScopeTaskSummary {
  id: string;
  title: string;
  filePath?: string;
  prompt: string;
  enabled: boolean;
  running: boolean;
  cron?: string;
  at?: string;
  model?: string;
  cwd?: string;
  lastStatus?: string;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastAttemptCount?: number;
}

export interface MemoryDocSummary {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  path: string;
  updated?: string;
}

export interface SkillSummary {
  name: string;
  source: string;
  description: string;
  path: string;
}

export interface ProfileAgentItemSummary {
  source: string;
  path: string;
}

export interface ServerRouteContext {
  getRuntimeScope: () => string;
  getRepoRoot: () => string;
  getRuntimeConfigRoot: () => string;
  materializeWebRuntimeConfig: (profile: string) => void;
  getSettingsFile: () => string;
  getAuthFile: () => string;
  getStateRoot: () => string;
  getServerPort: () => number;
  getDefaultWebCwd: () => string;
  resolveRequestedCwd: (cwd: string | null | undefined, defaultCwd?: string) => string | undefined;
  buildLiveSessionResourceOptions: (profile?: string) => LiveSessionResourceOptions;
  buildLiveSessionResourceOptionsAsync?: (profile?: string) => Promise<LiveSessionResourceOptions>;
  buildLiveSessionExtensionFactories: () => ExtensionFactory[];
  flushLiveDeferredResumes: () => Promise<void>;
  getSavedUiPreferences: () => SavedUiPreferences;
  listTasksForRuntimeScope: () => RuntimeScopeTaskSummary[];
  listMemoryDocs: () => MemoryDocSummary[];
  listSkillsForRuntimeScope: () => SkillSummary[];
  listProfileAgentItems: () => ProfileAgentItemSummary[];
  withTemporaryRuntimeAgentDir: <T>(profile: string, run: (agentDir: string) => Promise<T>) => Promise<T>;
  getDurableRunSnapshot: (runId: string, tail: number) => Promise<unknown | null>;
}

export interface RegisterServerRoutesInput {
  app: Express;
  context: ServerRouteContext;
}
