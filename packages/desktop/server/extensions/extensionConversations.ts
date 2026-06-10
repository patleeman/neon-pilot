import type { SessionEntry } from '@earendil-works/pi-coding-agent';

import { reserveConversationSession } from '../conversations/conversationReservation.js';
import {
  type LiveSessionCapabilityContext,
  submitLiveSessionPromptCapability,
} from '../conversations/liveSessionCapability.js';
import {
  appendStoredVisibleCustomMessage,
  renameStoredConversation,
  resolveConversationSessionFile,
} from '../conversations/conversationService.js';
import { readConversationSessionsCapability } from '../conversations/conversationSessionCapability.js';
import { broadcastTitle } from '../conversations/liveSessionBroadcasts.js';
import {
  abortSession as abortLiveSession,
  appendVisibleCustomMessage as appendVisibleLiveSessionCustomMessage,
  createSession,
  createSessionFromExisting,
  registry as liveSessionRegistry,
  resumeSession,
  subscribe as subscribeLiveSession,
  updateVisibleCustomMessage as updateVisibleLiveSessionCustomMessage,
} from '../conversations/liveSessions.js';
import { resolveStableSessionTitle } from '../conversations/liveSessionTitle.js';
import type { ServerRouteContext } from '../routes/context.js';
import { invalidateAppTopics, publishAppEvent } from '../shared/appEvents.js';
import { queryConversationMetadata, readConversationMetadata, writeConversationMetadata } from './extensionConversationMetadata.js';
import {
  buildLiveSessionExtensionFactoriesForRuntime,
  buildLiveSessionResourceOptionsForRuntime,
} from './runtimeAgentHooks.js';
import { publishExtensionHostEvent } from './extensionSubscriptions.js';

const reservedConversationFiles = new Map<string, string>();

export interface ExtensionConversationDetailOptions {
  tailBlocks?: number;
}

export interface ExtensionConversationSendOptions {
  /** Send as "steer" (interrupt current turn) — default false, uses "followUp". */
  steer?: boolean;
  /** Image attachments to send with the prompt. */
  images?: Array<{ data: string; mimeType: string; name?: string }>;
}

export interface ExtensionConversationSendResult {
  accepted: true;
  delivery: 'started' | 'queued';
}

export interface ExtensionConversationRunTurnOptions extends ExtensionConversationSendOptions {
  /** Cwd override used when the conversation must be resumed before sending. */
  cwd?: string;
  /** Maximum time to wait for a terminal live event. Default: 120 seconds. */
  timeoutMs?: number;
  /** Called for every live event observed for this turn. */
  onEvent?: (event: unknown) => void;
}

export interface ExtensionConversationCreateOptions {
  /** Working directory for the conversation. */
  cwd?: string;
  /** Set to false to create a persisted conversation shell without starting a live agent session. */
  live?: boolean;
  /** Optional initial prompt text. */
  prompt?: string;
  /** Model override. */
  model?: string | null;
  /** Thinking level override. */
  thinkingLevel?: string | null;
  /** Service tier override. */
  serviceTier?: string | null;
  /** When set, only these tool names are exposed to the created live session. */
  allowedToolNames?: string[];
}

export interface ExtensionConversationBlocksOptions {
  /** Number of most-recent blocks to return. */
  tailBlocks?: number;
}

export interface ExtensionConversationSubscriptionHandler {
  (event: unknown): void;
}

export interface ExtensionConversationSubscriptionOptions {
  tailBlocks?: number;
}

/**
 * Conversation capability factory.
 *
 * Write operations require the session to be live (in the in-memory registry).
 * Read-only meta operations work against persisted session data.
 */
export function createExtensionConversationsCapability(
  serverContext?: Pick<ServerRouteContext, 'getRuntimeScope'> &
    Partial<
      Pick<
        ServerRouteContext,
        | 'buildLiveSessionExtensionFactories'
        | 'buildLiveSessionResourceOptions'
        | 'buildLiveSessionResourceOptionsAsync'
        | 'flushLiveDeferredResumes'
        | 'getDefaultWebCwd'
        | 'getRepoRoot'
        | 'getSettingsFile'
        | 'listMemoryDocs'
        | 'listTasksForRuntimeScope'
      >
    >,
  extensionId = 'extension',
) {
  const findLiveEntry = (conversationId: string) => {
    const entry = liveSessionRegistry.get(conversationId);
    if (!entry) throw new Error(`Conversation "${conversationId}" is not live.`);
    return entry;
  };

  const removeDeletedConversationWorkspaceReferences = async (conversationIds: string[]) => {
    if (!serverContext?.getSettingsFile || conversationIds.length === 0) return;
    const deletedIds = new Set(conversationIds);
    const { readSavedUiPreferences, writeSavedUiPreferences } = await import('../ui/uiPreferences.js');
    const { persistSettingsWrite } = await import('../ui/settingsPersistence.js');
    const before = readSavedUiPreferences(serverContext.getSettingsFile());
    persistSettingsWrite(
      (settingsFile) =>
        writeSavedUiPreferences(
          {
            openConversationIds: before.openConversationIds.filter((id) => !deletedIds.has(id)),
            pinnedConversationIds: before.pinnedConversationIds.filter((id) => !deletedIds.has(id)),
            archivedConversationIds: before.archivedConversationIds.filter((id) => !deletedIds.has(id)),
            activeConversationId:
              before.activeConversationId && deletedIds.has(before.activeConversationId) ? null : before.activeConversationId,
            remoteControlledConversationIds: before.remoteControlledConversationIds.filter((id) => !deletedIds.has(id)),
          },
          settingsFile,
        ),
      { runtimeSettingsFile: serverContext.getSettingsFile() },
    );
  };

  const addCreatedConversationToWorkspace = async (conversationId: string) => {
    if (!serverContext?.getSettingsFile) return null;
    const { readSavedUiPreferences, writeSavedUiPreferences } = await import('../ui/uiPreferences.js');
    const { persistSettingsWrite } = await import('../ui/settingsPersistence.js');
    const before = readSavedUiPreferences(serverContext.getSettingsFile());
    if (
      before.openConversationIds.includes(conversationId) ||
      before.pinnedConversationIds.includes(conversationId) ||
      before.archivedConversationIds.includes(conversationId)
    ) {
      return before;
    }

    const saved = persistSettingsWrite(
      (settingsFile) =>
        writeSavedUiPreferences(
          {
            openConversationIds: [...before.openConversationIds, conversationId],
          },
          settingsFile,
        ),
      { runtimeSettingsFile: serverContext.getSettingsFile() },
    );
    await publishExtensionHostEvent('conversationSessions', {
      type: 'session.workspace.updated',
      openConversationIds: saved.openConversationIds,
      pinnedConversationIds: saved.pinnedConversationIds,
      archivedConversationIds: saved.archivedConversationIds,
      activeConversationId: saved.activeConversationId ?? null,
    });
    return saved;
  };

  const buildLiveSessionCapabilityContext = (): LiveSessionCapabilityContext => {
    const runtimeScope = serverContext?.getRuntimeScope ?? (() => 'shared');
    return {
      getRuntimeScope: runtimeScope,
      getRepoRoot: serverContext?.getRepoRoot ?? (() => process.env.NEON_PILOT_REPO_ROOT || process.cwd()),
      getDefaultWebCwd: serverContext?.getDefaultWebCwd ?? (() => process.env.NEON_PILOT_REPO_ROOT || process.cwd()),
      buildLiveSessionResourceOptions: serverContext?.buildLiveSessionResourceOptions ?? (() => buildLiveSessionResourceOptionsForRuntime()),
      ...(serverContext?.buildLiveSessionResourceOptionsAsync
        ? { buildLiveSessionResourceOptionsAsync: serverContext.buildLiveSessionResourceOptionsAsync }
        : {}),
      buildLiveSessionExtensionFactories:
        serverContext?.buildLiveSessionExtensionFactories ?? (() => buildLiveSessionExtensionFactoriesForRuntime()),
      flushLiveDeferredResumes: serverContext?.flushLiveDeferredResumes ?? (async () => {}),
      listTasksForRuntimeScope: serverContext?.listTasksForRuntimeScope ?? (() => []),
      listMemoryDocs: serverContext?.listMemoryDocs ?? (() => []),
    };
  };

  return {
    // ── Read operations ──────────────────────────────────────────────────

    async list(): Promise<unknown> {
      return readConversationSessionsCapability();
    },

    async getMeta(conversationId: string): Promise<unknown> {
      const entry = liveSessionRegistry.get(conversationId);
      if (!entry) {
        // Fall back to persisted meta
        const { readConversationSessionMetaCapability } = await import('../conversations/conversationSessionCapability.js');
        const meta = readConversationSessionMetaCapability(conversationId);
        if (!meta) throw new Error('Conversation not found.');
        return meta;
      }
      return {
        id: conversationId,
        title: resolveStableSessionTitle(entry.session),
        cwd: entry.cwd,
        running: entry.session.isStreaming,
        currentModel: entry.session.model?.id ?? null,
      };
    },

    async get(conversationId: string, _options?: ExtensionConversationDetailOptions): Promise<unknown> {
      const entry = findLiveEntry(conversationId);
      return {
        id: conversationId,
        title: resolveStableSessionTitle(entry.session),
        cwd: entry.cwd,
        running: entry.session.isStreaming,
        currentModel: entry.session.model?.id ?? null,
        stats: entry.session.getSessionStats(),
        toolNames: entry.session.getActiveToolNames(),
      };
    },

    async setActiveTools(conversationId: string, toolNames: string[]): Promise<{ conversationId: string; toolNames: string[] }> {
      const entry = findLiveEntry(conversationId);
      const patchable = entry.session as unknown as { setActiveTools?: (toolNames: string[]) => void; getActiveToolNames?: () => string[] };
      if (typeof patchable.setActiveTools !== 'function') {
        throw new Error(`Conversation "${conversationId}" does not support active tool updates.`);
      }
      const normalized = [...new Set(toolNames.map((toolName) => toolName.trim()).filter(Boolean))];
      patchable.setActiveTools(normalized);
      invalidateAppTopics('sessions');
      await publishExtensionHostEvent('conversationSessions', { type: 'session.tools.updated', conversationId, toolNames: normalized });
      return { conversationId, toolNames: patchable.getActiveToolNames?.() ?? normalized };
    },

    async appendCustomEntry(conversationId: string, customType: string, data?: unknown): Promise<{ ok: true }> {
      const entry = findLiveEntry(conversationId);
      const sessionManager = entry.session.sessionManager as unknown as {
        appendCustomEntry?: (type: string, entryData?: unknown) => void;
      };
      const normalizedType = customType.trim();
      if (!normalizedType) throw new Error('customType required.');
      if (typeof sessionManager.appendCustomEntry !== 'function') {
        throw new Error(`Conversation "${conversationId}" does not support custom entries.`);
      }
      sessionManager.appendCustomEntry(normalizedType, data);
      invalidateAppTopics('sessions');
      await publishExtensionHostEvent('conversationSessions', {
        type: 'session.customEntry.appended',
        conversationId,
        customType: normalizedType,
      });
      return { ok: true };
    },

    /**
     * Read conversation blocks (session detail).
     * Works for both live and persisted sessions.
     */
    async getBlocks(conversationId: string, options?: ExtensionConversationBlocksOptions): Promise<unknown> {
      const profile = serverContext?.getRuntimeScope?.() ?? 'shared';
      const { readSessionDetailForRoute } = await import('../conversations/conversationService.js');
      const { sessionRead } = await readSessionDetailForRoute({
        conversationId,
        profile,
        ...(options?.tailBlocks ? { tailBlocks: options.tailBlocks } : {}),
      });
      return sessionRead;
    },

    async searchIndex(sessionIds: string[]): Promise<unknown> {
      const { readConversationSessionSearchIndexCapability } = await import('../conversations/conversationSessionCapability.js');
      return readConversationSessionSearchIndexCapability({ sessionIds });
    },

    metadata: {
      async get(input: { conversationId: string; namespace?: string }): Promise<Record<string, unknown>> {
        return readConversationMetadata({
          conversationId: input.conversationId,
          namespace: input.namespace,
          extensionId,
          profile: serverContext?.getRuntimeScope?.() ?? 'shared',
        });
      },
      async set(input: { conversationId: string; namespace?: string; values: Record<string, unknown> }): Promise<Record<string, unknown>> {
        return writeConversationMetadata({
          conversationId: input.conversationId,
          namespace: input.namespace,
          values: input.values,
          extensionId,
          profile: serverContext?.getRuntimeScope?.() ?? 'shared',
        });
      },
      async query(input: {
        namespace?: string;
        where?: Array<{ key: string; op?: 'eq' | 'neq' | 'in' | 'exists'; value?: unknown }>;
        limit?: number;
      }): Promise<Array<{ conversationId: string; metadata: Record<string, unknown> }>> {
        return queryConversationMetadata({
          namespace: input.namespace?.trim() || extensionId,
          where: input.where,
          limit: input.limit,
          profile: serverContext?.getRuntimeScope?.() ?? 'shared',
        });
      },
    },

    async getWorkspace(): Promise<unknown> {
      if (!serverContext?.getSettingsFile) {
        throw new Error('Conversation workspace is unavailable.');
      }
      const { readSavedUiPreferences } = await import('../ui/uiPreferences.js');
      const saved = readSavedUiPreferences(serverContext.getSettingsFile());
      return {
        openConversationIds: saved.openConversationIds,
        pinnedConversationIds: saved.pinnedConversationIds,
        archivedConversationIds: saved.archivedConversationIds,
        activeConversationId: saved.activeConversationId ?? null,
        workspacePaths: saved.workspacePaths,
        remoteControlledConversationIds: saved.remoteControlledConversationIds,
      };
    },

    // ── Write operations ─────────────────────────────────────────────────

    async delete(input: { conversationIds: string[] }): Promise<unknown> {
      const conversationIds = [...new Set((input.conversationIds ?? []).map((id) => id.trim()).filter(Boolean))];
      if (conversationIds.length === 0) throw new Error('At least one conversation id is required.');
      const { deleteSessions } = await import('../conversations/sessions.js');
      const result = deleteSessions(conversationIds);
      await removeDeletedConversationWorkspaceReferences(result.deleted.map((entry) => entry.id));
      invalidateAppTopics('sessions');
      await publishExtensionHostEvent('conversationSessions', {
        type: 'session.deleted',
        conversationIds: result.deleted.map((entry) => entry.id),
      });
      return { ok: true, ...result };
    },

    async prune(input: { olderThanMs: number; archivedOnly?: boolean | null; dryRun?: boolean | null }): Promise<unknown> {
      const olderThanMs = Number(input.olderThanMs);
      if (!Number.isFinite(olderThanMs) || olderThanMs <= 0) throw new Error('olderThanMs must be a positive number.');
      const { pruneSessionsByRetention } = await import('../conversations/sessions.js');
      let archivedConversationIds: string[] = [];
      if (serverContext?.getSettingsFile) {
        const { readSavedUiPreferences } = await import('../ui/uiPreferences.js');
        archivedConversationIds = readSavedUiPreferences(serverContext.getSettingsFile()).archivedConversationIds;
      }
      const result = pruneSessionsByRetention({
        olderThanMs,
        archivedOnly: Boolean(input.archivedOnly),
        dryRun: Boolean(input.dryRun),
        archivedConversationIds,
      });
      if (!result.dryRun) {
        await removeDeletedConversationWorkspaceReferences(result.deleted.map((entry) => entry.id));
        invalidateAppTopics('sessions');
        await publishExtensionHostEvent('conversationSessions', {
          type: 'session.deleted',
          conversationIds: result.deleted.map((entry) => entry.id),
        });
      }
      return result;
    },

    async updateWorkspace(input: {
      openConversationIds?: string[] | null;
      pinnedConversationIds?: string[] | null;
      archivedConversationIds?: string[] | null;
      activeConversationId?: string | null;
      workspacePaths?: string[] | null;
      remoteControlledConversationIds?: string[] | null;
    }): Promise<unknown> {
      if (!serverContext?.getSettingsFile) {
        throw new Error('Conversation workspace is unavailable.');
      }
      const { readSavedUiPreferences, writeSavedUiPreferences } = await import('../ui/uiPreferences.js');
      const { persistSettingsWrite } = await import('../ui/settingsPersistence.js');
      const before = readSavedUiPreferences(serverContext.getSettingsFile());
      const saved = persistSettingsWrite(
        (settingsFile) =>
          writeSavedUiPreferences(
            {
              openConversationIds: input.openConversationIds,
              pinnedConversationIds: input.pinnedConversationIds,
              archivedConversationIds: input.archivedConversationIds,
              activeConversationId: input.activeConversationId,
              workspacePaths: input.workspacePaths,
              remoteControlledConversationIds: input.remoteControlledConversationIds,
            },
            settingsFile,
          ),
        { runtimeSettingsFile: serverContext.getSettingsFile() },
      );

      if (
        input.openConversationIds !== undefined ||
        input.pinnedConversationIds !== undefined ||
        input.archivedConversationIds !== undefined ||
        input.activeConversationId !== undefined ||
        before.openConversationIds.join('\0') !== saved.openConversationIds.join('\0') ||
        before.pinnedConversationIds.join('\0') !== saved.pinnedConversationIds.join('\0') ||
        before.archivedConversationIds.join('\0') !== saved.archivedConversationIds.join('\0') ||
        before.activeConversationId !== saved.activeConversationId
      ) {
        invalidateAppTopics('sessions');
        await publishExtensionHostEvent('conversationSessions', {
          type: 'session.workspace.updated',
          openConversationIds: saved.openConversationIds,
          pinnedConversationIds: saved.pinnedConversationIds,
          archivedConversationIds: saved.archivedConversationIds,
          activeConversationId: saved.activeConversationId ?? null,
        });
      }
      if (input.workspacePaths !== undefined || before.workspacePaths.join('\0') !== saved.workspacePaths.join('\0')) {
        invalidateAppTopics('workspace');
      }

      return {
        openConversationIds: saved.openConversationIds,
        pinnedConversationIds: saved.pinnedConversationIds,
        archivedConversationIds: saved.archivedConversationIds,
        activeConversationId: saved.activeConversationId ?? null,
        workspacePaths: saved.workspacePaths,
        remoteControlledConversationIds: saved.remoteControlledConversationIds,
      };
    },

    /**
     * Create a new conversation (live session).
     * Returns the bootstrap response when a prompt is provided, or session metadata otherwise.
     */
    async create(
      input?: ExtensionConversationCreateOptions & { title?: string; initialPrompt?: string },
    ): Promise<{ id: string; conversationId: string }> {
      const cwd = input?.cwd?.trim() || process.cwd();
      if (input?.live === false) {
        if (input.prompt?.trim() || input.initialPrompt?.trim()) {
          throw new Error('Non-live conversation creation does not support initial prompts.');
        }

        const reserved = reserveConversationSession({ cwd, profile: serverContext?.getRuntimeScope?.() });
        reservedConversationFiles.set(reserved.id, reserved.sessionFile);
        if (input.title?.trim()) {
          renameStoredConversation(reserved.id, input.title.trim());
        }
        await addCreatedConversationToWorkspace(reserved.id);
        invalidateAppTopics('sessions');
        publishAppEvent({ type: 'open_session', sessionId: reserved.id });
        await publishExtensionHostEvent('conversationSessions', { type: 'session.created', conversationId: reserved.id, cwd });
        return { id: reserved.id, conversationId: reserved.id };
      }

      const options: Record<string, unknown> = {};
      if (input?.model) options.initialModel = input.model;
      if (input?.thinkingLevel) options.initialThinkingLevel = input.thinkingLevel;
      if (input?.serviceTier) options.initialServiceTier = input.serviceTier;
      if (input?.allowedToolNames) options.allowedToolNames = input.allowedToolNames;

      const created = await createSession(cwd, options);

      const initialPrompt = input?.prompt?.trim() || input?.initialPrompt?.trim();
      if (input?.title?.trim()) {
        const entry = liveSessionRegistry.get(created.id);
        if (entry) {
          try {
            entry.session.setSessionName(input.title.trim());
          } catch {
            entry.title = input.title.trim();
          }
        }
      }
      if (initialPrompt) {
        const entry = liveSessionRegistry.get(created.id);
        if (entry) await entry.session.prompt(initialPrompt);
      }

      await addCreatedConversationToWorkspace(created.id);
      invalidateAppTopics('sessions');
      publishAppEvent({ type: 'open_session', sessionId: created.id });
      await publishExtensionHostEvent('conversationSessions', { type: 'session.created', conversationId: created.id, cwd });
      return { id: created.id, conversationId: created.id };
    },

    /**
     * Resume an existing session from its session file.
     */
    async resume(sessionFile: string, cwd?: string): Promise<{ id: string }> {
      const result = await resumeSession(sessionFile, cwd ? { cwdOverride: cwd } : undefined);
      invalidateAppTopics('sessions');
      await publishExtensionHostEvent('conversationSessions', { type: 'session.resumed', conversationId: result.id, sessionFile });
      return result;
    },

    /**
     * Ensure a persisted conversation is resumed into the live registry.
     */
    async ensureLive(conversationId: string, options?: { cwd?: string }): Promise<{ id: string; conversationId: string }> {
      const existing = liveSessionRegistry.get(conversationId);
      if (existing) {
        return { id: conversationId, conversationId };
      }

      const { resolveConversationSessionFile } = await import('../conversations/conversationService.js');
      const sessionFile = resolveConversationSessionFile(conversationId);
      if (!sessionFile) {
        throw new Error(`Conversation "${conversationId}" has no persisted session file.`);
      }

      const resumed = await resumeSession(sessionFile, options?.cwd ? { cwdOverride: options.cwd } : undefined);
      invalidateAppTopics('sessions');
      await publishExtensionHostEvent('conversationSessions', {
        type: 'session.resumed',
        conversationId: resumed.id,
        sourceConversationId: conversationId,
      });
      return { id: resumed.id, conversationId: resumed.id };
    },

    /**
     * Send a message into a live conversation.
     */
    async sendMessage(
      conversationId: string,
      text: string,
      options?: ExtensionConversationSendOptions,
    ): Promise<ExtensionConversationSendResult> {
      try {
        const result = await submitLiveSessionPromptCapability(
          {
            conversationId,
            text,
            behavior: options?.steer ? 'steer' : undefined,
            images: options?.images,
          },
          buildLiveSessionCapabilityContext(),
        );
        return { accepted: true, delivery: result.delivery };
      } catch (error) {
        throw new Error(`Failed to send message: ${(error as Error).message}`);
      }
    },

    /**
     * Atomically resume, subscribe, send, and wait for a terminal turn event.
     */
    async runTurn(conversationId: string, text: string, options?: ExtensionConversationRunTurnOptions): Promise<{ accepted: boolean }> {
      await this.ensureLive(conversationId, options?.cwd ? { cwd: options.cwd } : undefined);

      let settled = false;
      let unsubscribe: (() => void) | null = null;
      const cleanup = () => {
        const current = unsubscribe;
        unsubscribe = null;
        current?.();
      };
      const timeoutMs = Math.max(1, options?.timeoutMs ?? 120_000);

      const terminal = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error(`Timed out waiting for conversation "${conversationId}" turn to finish.`));
        }, timeoutMs);
        timeout.unref?.();

        unsubscribe = this.subscribe(conversationId, (event: unknown) => {
          options?.onEvent?.(event);
          const ev = event as Record<string, unknown> | null;
          if (!ev || typeof ev.type !== 'string') return;
          if (ev.type !== 'turn_end' && ev.type !== 'error') return;
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          cleanup();
          if (ev.type === 'error') {
            reject(new Error(typeof ev.message === 'string' ? ev.message : 'Conversation turn failed.'));
            return;
          }
          resolve();
        });

        if (!unsubscribe) {
          clearTimeout(timeout);
          settled = true;
          reject(new Error(`Conversation "${conversationId}" is not live.`));
        }
      });

      try {
        await this.sendMessage(conversationId, text, options);
        await terminal;
        return { accepted: true };
      } catch (error) {
        if (!settled) {
          settled = true;
          cleanup();
        }
        throw error;
      }
    },

    /**
     * Abort a live conversation turn.
     */
    async abort(conversationId: string): Promise<{ ok: true }> {
      await abortLiveSession(conversationId);
      invalidateAppTopics('sessions');
      return { ok: true };
    },

    /**
     * Append a visible system/custom message without starting an agent turn.
     */
    async appendVisibleCustomMessage(
      conversationId: string,
      customType: string,
      content: string,
      details?: unknown,
    ): Promise<{ ok: true }> {
      await appendVisibleLiveSessionCustomMessage(conversationId, customType, content, details);
      invalidateAppTopics('sessions');
      return { ok: true };
    },

    /**
     * Update the title of a live conversation.
     */
    async setTitle(conversationId: string, title: string): Promise<{ ok: true }> {
      const entry = findLiveEntry(conversationId);
      try {
        entry.session.setSessionName(title);
      } catch {
        entry.title = title;
      }
      broadcastTitle(entry, {
        resolveEntryTitle: (e) => resolveStableSessionTitle(e.session),
        publishSessionMetaChanged: () => {
          invalidateAppTopics('sessions');
        },
      });
      await publishExtensionHostEvent('conversationSessions', { type: 'session.renamed', conversationId, title });
      return { ok: true };
    },

    /**
     * Trigger compaction on a live conversation.
     */
    async compact(conversationId: string, customInstructions?: string): Promise<{ ok: true }> {
      const entry = findLiveEntry(conversationId);
      await entry.session.compact(customInstructions);
      invalidateAppTopics('sessions');
      return { ok: true };
    },

    /**
     * Fork a conversation into a new live session.
     * Creates a new session in the specified cwd (or same cwd) with the full history.
     * Returns the new conversation id.
     */
    async fork(
      input: string | { conversationId: string; targetCwd?: string; cwd?: string; title?: string },
    ): Promise<{ id: string; conversationId: string }> {
      const conversationId = typeof input === 'string' ? input : input.conversationId;
      const entry = findLiveEntry(conversationId);
      const sessionManager = (entry.session as unknown as { sessionManager: { getSessionFile(): string | undefined } }).sessionManager;
      const sessionFile = sessionManager.getSessionFile();
      if (!sessionFile) throw new Error('Source session has no persisted file');

      const targetCwd = typeof input === 'string' ? undefined : (input.targetCwd ?? input.cwd);
      const cwd = targetCwd?.trim() || entry.cwd;
      const result = await createSessionFromExisting(sessionFile, cwd);
      const forked = liveSessionRegistry.get(result.id);
      if (forked && typeof input !== 'string' && input.title?.trim()) {
        try {
          forked.session.setSessionName(input.title.trim());
        } catch {
          forked.title = input.title.trim();
        }
      }
      invalidateAppTopics('sessions');
      await publishExtensionHostEvent('conversationSessions', {
        type: 'session.forked',
        conversationId: result.id,
        sourceConversationId: conversationId,
      });
      return { id: result.id, conversationId: result.id };
    },

    async appendTranscriptBlock(input: {
      conversationId: string;
      blockType: string;
      data: unknown;
      title?: string;
      blockId?: string;
    }): Promise<{ blockId: string }> {
      const content = input.title ?? input.blockType;
      if (!liveSessionRegistry.has(input.conversationId)) {
        const sessionFile = resolveConversationSessionFile(input.conversationId) ?? reservedConversationFiles.get(input.conversationId);
        if (!sessionFile) {
          throw new Error(`Conversation "${input.conversationId}" was not found.`);
        }
        const blockId = appendStoredVisibleCustomMessage({
          sessionFile,
          customType: input.blockType,
          content,
          details: input.data,
          blockId: input.blockId,
        });
        invalidateAppTopics('sessions');
        return { blockId: blockId ?? input.blockId ?? `${input.blockType}:${Date.now()}` };
      }

      const blockId = await appendVisibleLiveSessionCustomMessage(input.conversationId, input.blockType, content, input.data, {
        blockId: input.blockId,
      });
      invalidateAppTopics('sessions');
      return { blockId: blockId ?? input.blockId ?? `${input.blockType}:${Date.now()}` };
    },

    async updateTranscriptBlock(input: {
      conversationId: string;
      blockType: string;
      data: unknown;
      title?: string;
      blockId: string;
    }): Promise<{ blockId: string }> {
      const updated = updateVisibleLiveSessionCustomMessage(
        input.conversationId,
        input.blockId,
        input.blockType,
        input.title ?? input.blockType,
        input.data,
      );
      if (!updated) throw new Error(`Transcript block "${input.blockId}" was not found.`);
      invalidateAppTopics('sessions');
      return { blockId: input.blockId };
    },

    /**
     * Roll back a conversation by N turns.
     * Moves the leaf pointer backwards in the session tree to the entry
     * before the Nth user message counted from the end.
     */
    async rollback(conversationId: string, count: number): Promise<{ rolledBackTo: string | null }> {
      if (count < 1) throw new Error('count must be >= 1');

      const entry = findLiveEntry(conversationId);
      const liveEntry = entry;
      const sessionManager = (
        liveEntry.session as unknown as {
          sessionManager: {
            getLeafId(): string | null;
            getBranch(fromId?: string): SessionEntry[];
            branch(fromId: string): void;
          };
        }
      ).sessionManager;

      const leafId = sessionManager.getLeafId();
      if (!leafId) return { rolledBackTo: null };

      const branch = sessionManager.getBranch(leafId);
      if (branch.length === 0) return { rolledBackTo: null };

      // Walk backwards from the end, counting user messages as turns
      let turnsFound = 0;
      let targetEntryId: string | null = null;

      for (let i = branch.length - 1; i >= 0; i--) {
        const currentEntry = branch[i];
        if (currentEntry.type === 'message' && (currentEntry.message as { role?: string }).role === 'user') {
          turnsFound++;
          if (turnsFound === count) {
            // Target is parent of this user message (before this turn)
            targetEntryId = currentEntry.parentId;
            break;
          }
        }
      }

      if (!targetEntryId) return { rolledBackTo: null };

      sessionManager.branch(targetEntryId);
      invalidateAppTopics('sessions');
      return { rolledBackTo: targetEntryId };
    },

    // ── Real-time subscriptions ──────────────────────────────────────────

    /**
     * Subscribe to real-time conversation events.
     * Returns an unsubscribe function.
     */
    subscribe(
      conversationId: string,
      handler: ExtensionConversationSubscriptionHandler,
      options?: ExtensionConversationSubscriptionOptions,
    ): (() => void) | null {
      const unsubscribe = subscribeLiveSession(conversationId, handler, {
        ...(options?.tailBlocks ? { tailBlocks: options.tailBlocks } : {}),
      });
      return unsubscribe;
    },
  };
}
