import { type Dirent, existsSync, type FSWatcher, readdirSync, statSync, watch } from 'node:fs';
import { basename, dirname, join, normalize } from 'node:path';

import {
  getDurableTasksDir,
  getPiAgentRuntimeDir,
  getStateRoot,
  resolveConversationAttentionStatePath,
  resolveDeferredResumeStateFile,
  resolveProfileAlertsStateFile,
  resolveProfileConversationArtifactsDir,
  resolveProfileConversationAttachmentsDir,
  resolveProfileConversationCommitCheckpointsDir,
} from '@neon-pilot/core';
import { getDaemonConfigFilePath, loadDaemonConfig, resolveDaemonPaths, resolveDurableRunsRoot } from '@neon-pilot/daemon';

import { clearDurableRunsListCache } from '../automation/durableRuns.js';
import { readKnownConversationIdByFilePath } from '../conversations/conversationService.js';
import type { ParallelPromptPreview } from '../conversations/liveSessionParallelJobs.js';
import { persistAppTelemetryEvent } from '../traces/appTelemetry.js';
import { logWarn } from './logging.js';

export type AppEventTopic =
  | 'sessions'
  | 'sessionFiles'
  | 'artifacts'
  | 'checkpoints'
  | 'attachments'
  | 'documents'
  | 'extensions'
  | 'tasks'
  | 'models'
  | 'runs'
  | 'executions'
  | 'automation'
  | 'daemon'
  | 'workspace'
  | 'knowledgeBase'
  | 'notifications'
  | 'inbox'
  | 'readiness';

export type AppEvent =
  | { type: 'connected' }
  | { type: 'invalidate'; topics: AppEventTopic[] }
  | { type: 'live_title'; sessionId: string; title: string }
  | { type: 'conversation_state_changed'; conversation: ConversationRuntimeState }
  | { type: 'notification'; extensionId: string; message: string; severity: string; details?: string }
  | { type: 'extension_command'; command: string; args?: unknown; sourceExtensionId?: string; requestId?: string }
  | {
      type: 'extension_ui_confirm';
      requestId: string;
      extensionId: string;
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      timeoutMs: number;
      details?: Array<{ label: string; value: string }>;
    }
  | { type: 'session_meta_changed'; sessionId: string }
  | { type: 'session_file_changed'; sessionId: string }
  | {
      type: 'conversation_workspace_changed';
      sessionIds: string[];
      pinnedSessionIds: string[];
      archivedSessionIds: string[];
      conversationPlacements?: Record<string, 'closed' | 'open' | 'pinned' | 'archived'>;
      activeConversationId: string | null;
      workspacePaths: string[];
      remoteControlledConversationIds: string[];
      conversationWorkspaceRevision: number;
      conversationWorkspaceUpdatedAt: string | null;
      conversationWorkspaceMigratedAt: string | null;
    }
  | { type: 'open_session'; sessionId: string };

export interface ConversationRuntimeState {
  id: string;
  revision: number;
  updatedAt: string;
  running: boolean;
  parallelJobs?: ParallelPromptPreview[];
}

let conversationRuntimeRevision = 0;

export function publishConversationRuntimeState(input: {
  conversationId: string;
  running: boolean;
  parallelJobs?: ParallelPromptPreview[];
}): void {
  const conversationId = input.conversationId.trim();
  if (!conversationId) return;
  conversationRuntimeRevision += 1;
  publishAppEvent({
    type: 'conversation_state_changed',
    conversation: {
      id: conversationId,
      running: input.running,
      ...(input.parallelJobs ? { parallelJobs: input.parallelJobs } : {}),
      revision: conversationRuntimeRevision,
      updatedAt: new Date().toISOString(),
    },
  });
}

export interface AppEventMonitorOptions {
  repoRoot: string;
  sessionsDir: string;
  taskStateFile: string;
  profileConfigFile: string;
  getRuntimeScope: () => string;
  intervalMs?: number;
}

type AppEventWatchKind = 'change' | 'rename';

interface AppEventWatchSource {
  path: string;
  kind: 'file' | 'directory';
  eventKinds?: readonly AppEventWatchKind[];
}

type TopicSources = Record<AppEventTopic, AppEventWatchSource[]>;
type AppEventListener = (event: AppEvent) => void;
type WatchStop = () => void;

interface AppEventWatchTarget {
  path: string;
  topics: Set<AppEventTopic>;
  recursive: boolean;
  rebuildOnEvent: boolean;
  filterName?: string;
  eventKinds?: readonly AppEventWatchKind[];
}

const SESSION_FILE_CHANGED_MIN_INTERVAL_MS = 500;
const DEFAULT_APP_EVENT_POLL_INTERVAL_MS = 5_000;
const RECURSIVE_SESSION_FILE_POLL_INTERVAL_MULTIPLIER = 4;
const SESSION_FILE_SIGNATURE_SCAN_BATCH_SIZE = 8;
const SESSION_FILE_SIGNATURE_SCAN_YIELD_MS = 8;

const ALL_TOPICS: AppEventTopic[] = [
  'sessions',
  'sessionFiles',
  'artifacts',
  'checkpoints',
  'attachments',
  'documents',
  'extensions',
  'tasks',
  'models',
  'runs',
  'executions',
  'automation',
  'daemon',
  'workspace',
  'knowledgeBase',
  'notifications',
  'inbox',
  'readiness',
];
const listeners = new Set<AppEventListener>();
let monitorStop: WatchStop | undefined;
const lastSessionFileChangedEventAtMs = new Map<string, number>();

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function collectDirectoryTree(root: string): string[] {
  if (!isDirectory(root)) {
    return [];
  }

  const directories: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop() as string;
    directories.push(current);

    let entries: Dirent[];
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      stack.push(join(current, entry.name));
    }
  }

  directories.sort((left, right) => left.localeCompare(right));
  return directories;
}

function collectSessionFileSignaturesInDirectory(directory: string, signatures: Map<string, string>): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (typeof entry.isFile !== 'function' || !entry.isFile() || !entry.name.endsWith('.jsonl')) {
      continue;
    }

    const filePath = join(directory, entry.name);
    try {
      const stat = statSync(filePath);
      signatures.set(filePath, `${stat.mtimeMs}:${stat.size}`);
    } catch {
      // The file may have been moved between readdir and stat; the next pass will resync it.
    }
  }
}

function listChildDirectories(directory: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const directories: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      directories.push(join(directory, entry.name));
    }
  }
  directories.sort((left, right) => right.localeCompare(left));
  return directories;
}

function startSessionFileSignaturePoll(
  root: string,
  intervalMs: number,
  onEvent: (eventKind: AppEventWatchKind, changedPath: string | null) => void,
): WatchStop {
  let signatures = new Map<string, string>();
  let hasBaseline = false;
  let scanning = false;
  let stopped = false;
  let scanTimer: ReturnType<typeof setTimeout> | undefined;

  const runScan = () => {
    if (stopped || scanning) {
      return;
    }
    if (!isDirectory(root)) {
      signatures = new Map();
      hasBaseline = true;
      return;
    }

    scanning = true;
    const nextSignatures = new Map<string, string>();
    const directories = [root];

    const scanChunk = () => {
      if (stopped) {
        scanning = false;
        return;
      }

      for (let index = 0; index < SESSION_FILE_SIGNATURE_SCAN_BATCH_SIZE && directories.length > 0; index += 1) {
        const directory = directories.pop() as string;
        collectSessionFileSignaturesInDirectory(directory, nextSignatures);
        directories.push(...listChildDirectories(directory));
      }

      if (directories.length > 0) {
        scanTimer = setTimeout(scanChunk, SESSION_FILE_SIGNATURE_SCAN_YIELD_MS);
        scanTimer.unref?.();
        return;
      }

      if (hasBaseline) {
        for (const [filePath, signature] of nextSignatures) {
          if (signatures.get(filePath) !== signature) {
            onEvent(signatures.has(filePath) ? 'change' : 'rename', filePath);
          }
        }
      }

      signatures = nextSignatures;
      hasBaseline = true;
      scanning = false;
      scanTimer = undefined;
    };

    scanChunk();
  };

  const pollTimer = setInterval(runScan, intervalMs);
  pollTimer.unref?.();
  scanTimer = setTimeout(runScan, 0);
  scanTimer.unref?.();

  return () => {
    stopped = true;
    clearInterval(pollTimer);
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = undefined;
    }
  };
}

function normalizeWatchRelativePath(filename: string | Buffer | null | undefined): string | null {
  if (typeof filename === 'string') {
    return filename;
  }

  if (filename instanceof Buffer) {
    return filename.toString('utf-8');
  }

  return null;
}

function resolveWatchPath(rootPath: string, filename: string | Buffer | null | undefined): string | null {
  const relativePath = normalizeWatchRelativePath(filename);
  if (!relativePath) {
    return null;
  }

  return normalize(join(rootPath, relativePath));
}

function matchesWatchFilename(changedPath: string | null | undefined, filterName: string | undefined): boolean {
  if (!filterName || !changedPath) {
    return true;
  }

  return basename(changedPath) === filterName;
}

function findNearestExistingDirectory(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      return current;
    }

    current = parent;
  }

  return isDirectory(current) ? current : dirname(current);
}

function readConversationIdFromSessionFilename(filePath: string): string | null {
  const match = /^.+_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i.exec(basename(filePath));
  return match?.[1] ?? null;
}

function createTopicSources(options: AppEventMonitorOptions, profile: string): TopicSources {
  const daemonConfig = loadDaemonConfig();
  const daemonPaths = resolveDaemonPaths(daemonConfig.ipc.socketPath);
  // Activity state can update frequently while an agent is streaming. It is not
  // part of the canonical conversation list, so do not wire it to the broad
  // sessions invalidation topic; refreshes here trigger expensive list reads and
  // renderer churn on the critical streaming path.
  const conversationArtifactsDir = resolveProfileConversationArtifactsDir({ profile });
  const conversationCommitCheckpointsDir = resolveProfileConversationCommitCheckpointsDir({ profile });
  const conversationAttachmentsDir = resolveProfileConversationAttachmentsDir({ profile });
  const tasksDir = getDurableTasksDir();
  const daemonStateDir = dirname(options.taskStateFile);
  const runtimeDbFile = join(daemonStateDir, 'runtime.db');
  const runsRoot = resolveDurableRunsRoot(daemonStateDir);
  const conversationAttentionStateFile = resolveConversationAttentionStatePath({ profile });
  const deferredResumeStateFile = resolveDeferredResumeStateFile();
  const alertsStateFile = resolveProfileAlertsStateFile({ profile });

  return {
    sessions: [
      { path: conversationAttentionStateFile, kind: 'file' },
      { path: deferredResumeStateFile, kind: 'file' },
      { path: alertsStateFile, kind: 'file' },
    ],
    sessionFiles: [{ path: options.sessionsDir, kind: 'directory', eventKinds: ['change', 'rename'] }],
    artifacts: [{ path: conversationArtifactsDir, kind: 'directory' }],
    checkpoints: [{ path: conversationCommitCheckpointsDir, kind: 'directory' }],
    attachments: [{ path: conversationAttachmentsDir, kind: 'directory' }],
    tasks: [
      { path: tasksDir, kind: 'directory' },
      { path: runtimeDbFile, kind: 'file' },
      { path: `${runtimeDbFile}-wal`, kind: 'file' },
      { path: `${runtimeDbFile}-shm`, kind: 'file' },
      { path: options.taskStateFile, kind: 'file' },
      { path: `${options.taskStateFile}-wal`, kind: 'file' },
      { path: `${options.taskStateFile}-shm`, kind: 'file' },
    ],
    runs: [{ path: runsRoot, kind: 'directory' }],
    executions: [],
    extensions: [{ path: join(getStateRoot(), 'extensions'), kind: 'directory', eventKinds: ['change', 'rename'] }],
    automation: [],
    models: [],
    daemon: [
      { path: getDaemonConfigFilePath(), kind: 'file' },
      { path: daemonPaths.socketPath, kind: 'file' },
    ],
    workspace: [{ path: join(getPiAgentRuntimeDir(), 'settings.json'), kind: 'file' }],
    documents: [],
    knowledgeBase: [],
    notifications: [],
    inbox: [],
    readiness: [],
  };
}

function buildWatchTargets(options: AppEventMonitorOptions, profile: string): AppEventWatchTarget[] {
  const topicSources = createTopicSources(options, profile);
  const targets = new Map<string, AppEventWatchTarget>();

  const addTarget = (target: Omit<AppEventWatchTarget, 'topics'>, topic: AppEventTopic) => {
    const key = [
      target.path,
      target.recursive ? 'recursive' : 'basic',
      target.rebuildOnEvent ? 'rebuild' : 'steady',
      target.filterName ?? '*',
      target.eventKinds?.join(',') ?? '*',
    ].join('|');

    const existing = targets.get(key);
    if (existing) {
      existing.topics.add(topic);
      return;
    }

    targets.set(key, {
      ...target,
      topics: new Set([topic]),
    });
  };

  for (const topic of ALL_TOPICS) {
    for (const source of topicSources[topic]) {
      if (source.kind === 'file') {
        const parent = dirname(source.path);
        if (isDirectory(parent)) {
          addTarget(
            {
              path: parent,
              recursive: false,
              rebuildOnEvent: false,
              filterName: basename(source.path),
              eventKinds: source.eventKinds,
            },
            topic,
          );
          continue;
        }

        addTarget(
          {
            path: findNearestExistingDirectory(parent),
            recursive: true,
            rebuildOnEvent: true,
            filterName: basename(source.path),
            eventKinds: source.eventKinds,
          },
          topic,
        );
        continue;
      }

      if (isDirectory(source.path)) {
        addTarget(
          {
            path: source.path,
            recursive: true,
            rebuildOnEvent: false,
            eventKinds: source.eventKinds,
          },
          topic,
        );

        const parent = dirname(source.path);
        if (isDirectory(parent)) {
          addTarget(
            {
              path: parent,
              recursive: false,
              rebuildOnEvent: true,
              filterName: basename(source.path),
              eventKinds: source.eventKinds,
            },
            topic,
          );
        }
        continue;
      }

      const parent = dirname(source.path);
      if (isDirectory(parent)) {
        addTarget(
          {
            path: parent,
            recursive: false,
            rebuildOnEvent: true,
            filterName: basename(source.path),
            eventKinds: source.eventKinds,
          },
          topic,
        );
        continue;
      }

      addTarget(
        {
          path: findNearestExistingDirectory(parent),
          recursive: true,
          rebuildOnEvent: true,
          filterName: basename(source.path),
          eventKinds: source.eventKinds,
        },
        topic,
      );
    }
  }

  return [...targets.values()];
}

function startBasicWatch(path: string, onEvent: (eventKind: AppEventWatchKind, changedPath: string | null) => void): WatchStop {
  const watcher = watch(path, { persistent: false }, (eventType, filename) => {
    onEvent(eventType === 'rename' ? 'rename' : 'change', resolveWatchPath(path, filename));
  });

  return () => watcher.close();
}

function startManualDirectoryTreeWatch(
  path: string,
  onEvent: (eventKind: AppEventWatchKind, changedPath: string | null) => void,
): WatchStop {
  const watchers = new Map<string, FSWatcher>();
  let syncTimer: ReturnType<typeof setTimeout> | undefined;

  const sync = () => {
    const nextDirectories = new Set(collectDirectoryTree(path));

    for (const [directory, watcher] of watchers) {
      if (nextDirectories.has(directory)) {
        continue;
      }

      watcher.close();
      watchers.delete(directory);
    }

    for (const directory of nextDirectories) {
      if (watchers.has(directory)) {
        continue;
      }

      try {
        const watcher = watch(directory, { persistent: false }, (eventType, filename) => {
          const eventKind = eventType === 'rename' ? 'rename' : 'change';
          onEvent(eventKind, resolveWatchPath(directory, filename));
          if (eventKind === 'rename') {
            scheduleSync();
          }
        });
        watchers.set(directory, watcher);
      } catch (error) {
        logWarn('app event watch registration failed', {
          path: directory,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  const scheduleSync = () => {
    if (syncTimer) {
      return;
    }

    syncTimer = setTimeout(() => {
      syncTimer = undefined;
      sync();
    }, 75);
  };

  sync();

  return () => {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = undefined;
    }

    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
  };
}

function startDirectoryTreeWatch(path: string, onEvent: (eventKind: AppEventWatchKind, changedPath: string | null) => void): WatchStop {
  try {
    const watcher = watch(path, { persistent: false, recursive: true }, (eventType, filename) => {
      onEvent(eventType === 'rename' ? 'rename' : 'change', resolveWatchPath(path, filename));
    });

    return () => watcher.close();
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
    if (code !== 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
      throw error;
    }
  }

  return startManualDirectoryTreeWatch(path, onEvent);
}

function startSessionFilesWatch(
  path: string,
  intervalMs: number,
  onEvent: (eventKind: AppEventWatchKind, changedPath: string | null) => void,
): WatchStop {
  let stopWatch: WatchStop;
  let pollIntervalMs = intervalMs;
  try {
    const watcher = watch(path, { persistent: false, recursive: true }, (eventType, filename) => {
      onEvent(eventType === 'rename' ? 'rename' : 'change', resolveWatchPath(path, filename));
    });

    const stopManualWatch = startManualDirectoryTreeWatch(path, onEvent);
    stopWatch = () => {
      watcher.close();
      stopManualWatch();
    };
    pollIntervalMs = intervalMs * RECURSIVE_SESSION_FILE_POLL_INTERVAL_MULTIPLIER;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
    if (code !== 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
      throw error;
    }
    stopWatch = startManualDirectoryTreeWatch(path, onEvent);
  }

  const stopSignaturePoll = startSessionFileSignaturePoll(path, pollIntervalMs, onEvent);

  return () => {
    stopSignaturePoll();
    stopWatch();
  };
}

function startWatchTarget(
  target: AppEventWatchTarget,
  pollIntervalMs: number,
  onTopics: (topics: Iterable<AppEventTopic>) => void,
  queueConversationSessionFileChange: (changedPath: string | null) => void,
  scheduleRebuild: () => void,
): WatchStop {
  const handleEvent = (eventKind: AppEventWatchKind, changedPath: string | null) => {
    if (!matchesWatchFilename(changedPath, target.filterName)) {
      return;
    }

    if (target.eventKinds && !target.eventKinds.includes(eventKind)) {
      return;
    }

    if (target.topics.has('sessionFiles')) {
      queueConversationSessionFileChange(changedPath);
    }

    onTopics(target.topics);
    if (target.rebuildOnEvent) {
      scheduleRebuild();
    }
  };

  try {
    if (target.recursive && target.topics.has('sessionFiles')) {
      return startSessionFilesWatch(target.path, pollIntervalMs, handleEvent);
    }
    return target.recursive ? startDirectoryTreeWatch(target.path, handleEvent) : startBasicWatch(target.path, handleEvent);
  } catch (error) {
    logWarn('app event watch registration failed', {
      path: target.path,
      message: error instanceof Error ? error.message : String(error),
    });
    scheduleRebuild();
    return () => {};
  }
}

function startProfileConfigWatch(profileConfigFile: string, onChange: () => void): WatchStop {
  const parent = dirname(profileConfigFile);
  if (isDirectory(parent)) {
    return startBasicWatch(parent, (_eventKind, changedPath) => {
      if (!matchesWatchFilename(changedPath, basename(profileConfigFile))) {
        return;
      }

      onChange();
    });
  }

  const ancestor = findNearestExistingDirectory(parent);
  return startDirectoryTreeWatch(ancestor, () => {
    onChange();
  });
}

export function publishAppEvent(event: AppEvent): void {
  persistAppTelemetryEvent({
    source: 'server',
    category: 'app_event',
    name: event.type,
    sessionId: 'sessionId' in event ? event.sessionId : undefined,
    count: event.type === 'invalidate' ? event.topics.length : undefined,
    metadata: event.type === 'invalidate' ? { topics: event.topics } : undefined,
  });
  for (const listener of listeners) {
    listener(event);
  }
}

export function invalidateAppTopics(...topics: AppEventTopic[]): void {
  const expandedTopics = topics.includes('runs') ? [...topics, 'executions' as const] : topics;
  const uniqueTopics = [...new Set(expandedTopics)].sort();
  if (uniqueTopics.length === 0) {
    return;
  }

  if (uniqueTopics.includes('runs') || uniqueTopics.includes('executions')) {
    clearDurableRunsListCache();
  }

  publishAppEvent({ type: 'invalidate', topics: uniqueTopics });
}

export function subscribeAppEvents(listener: AppEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function stopAppEventMonitor(): void {
  monitorStop?.();
}

export function startAppEventMonitor(options: AppEventMonitorOptions): void {
  if (monitorStop) {
    return;
  }

  let watcherStops: WatchStop[] = [];
  let profileWatcherStop: WatchStop | undefined;
  let runtimeScope = options.getRuntimeScope();
  let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  let rebuildTimer: ReturnType<typeof setTimeout> | undefined;
  const pollIntervalMs =
    Number.isSafeInteger(options.intervalMs) && (options.intervalMs as number) > 0
      ? Math.max(250, options.intervalMs as number)
      : DEFAULT_APP_EVENT_POLL_INTERVAL_MS;
  const pendingTopics = new Set<AppEventTopic>();
  const pendingConversationSessionFilePaths = new Set<string>();

  const flushInvalidations = () => {
    invalidateTimer = undefined;

    const topics = [...pendingTopics];
    pendingTopics.clear();
    if (topics.length > 0) {
      invalidateAppTopics(...topics);
    }

    if (pendingConversationSessionFilePaths.size === 0) {
      return;
    }

    const sessionIds = new Set<string>();
    for (const filePath of pendingConversationSessionFilePaths) {
      const sessionId = readConversationIdFromSessionFilename(filePath) ?? readKnownConversationIdByFilePath(filePath)?.trim();
      if (sessionId) {
        sessionIds.add(sessionId);
      }
    }
    pendingConversationSessionFilePaths.clear();

    const nowMs = Date.now();
    for (const sessionId of sessionIds) {
      const lastEventAtMs = lastSessionFileChangedEventAtMs.get(sessionId);
      if (lastEventAtMs !== undefined && nowMs - lastEventAtMs < SESSION_FILE_CHANGED_MIN_INTERVAL_MS) {
        continue;
      }
      lastSessionFileChangedEventAtMs.set(sessionId, nowMs);
      publishAppEvent({ type: 'session_file_changed', sessionId });
    }
  };

  const queueInvalidation = (topics: Iterable<AppEventTopic>) => {
    for (const topic of topics) {
      pendingTopics.add(topic);
    }

    if (invalidateTimer) {
      return;
    }

    invalidateTimer = setTimeout(flushInvalidations, 75);
  };

  const queueConversationSessionFileChange = (changedPath: string | null) => {
    const normalizedPath = changedPath?.trim();
    if (!normalizedPath || !normalizedPath.endsWith('.jsonl')) {
      return;
    }

    pendingConversationSessionFilePaths.add(normalizedPath);
    if (invalidateTimer) {
      return;
    }

    invalidateTimer = setTimeout(flushInvalidations, 75);
  };

  const rebuildWatchers = () => {
    for (const stop of watcherStops) {
      stop();
    }
    watcherStops = buildWatchTargets(options, runtimeScope).map((target) =>
      startWatchTarget(target, pollIntervalMs, queueInvalidation, queueConversationSessionFileChange, scheduleRebuild),
    );
  };

  const refreshProfile = () => {
    const nextProfile = options.getRuntimeScope();
    const profileChanged = nextProfile !== runtimeScope;
    runtimeScope = nextProfile;
    rebuildWatchers();

    if (profileChanged) {
      queueInvalidation(ALL_TOPICS);
    }
  };

  const scheduleRebuild = () => {
    if (rebuildTimer) {
      return;
    }

    rebuildTimer = setTimeout(() => {
      rebuildTimer = undefined;
      try {
        refreshProfile();
      } catch (error) {
        logWarn('app event watch refresh failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }, 75);
  };

  rebuildWatchers();
  profileWatcherStop = startProfileConfigWatch(options.profileConfigFile, scheduleRebuild);

  monitorStop = () => {
    if (invalidateTimer) {
      clearTimeout(invalidateTimer);
      invalidateTimer = undefined;
    }
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuildTimer = undefined;
    }

    for (const stop of watcherStops) {
      stop();
    }
    watcherStops = [];
    profileWatcherStop?.();
    profileWatcherStop = undefined;
    pendingTopics.clear();
    pendingConversationSessionFilePaths.clear();
    lastSessionFileChangedEventAtMs.clear();
    monitorStop = undefined;
  };
}
