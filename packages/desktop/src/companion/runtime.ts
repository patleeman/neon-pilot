import { Buffer } from 'node:buffer';

import type {
  CompanionAttachmentAssetInput,
  CompanionAttachmentCreateInput,
  CompanionAttachmentUpdateInput,
  CompanionBinaryAsset,
  CompanionConversationAbortInput,
  CompanionConversationBlockImageInput,
  CompanionConversationBootstrapInput,
  CompanionConversationBranchInput,
  CompanionConversationCheckpointCreateInput,
  CompanionConversationCreateInput,
  CompanionConversationCwdChangeInput,
  CompanionConversationDuplicateInput,
  CompanionConversationExecutionTargetChangeInput,
  CompanionConversationForkInput,
  CompanionConversationModelPreferencesUpdateInput,
  CompanionConversationPromptInput,
  CompanionConversationQueueRestoreInput,
  CompanionConversationRenameInput,
  CompanionConversationResumeInput,
  CompanionConversationSubscriptionInput,
  CompanionConversationTabsUpdateInput,
  CompanionConversationTakeoverInput,
  CompanionDurableRunLogInput,
  CompanionKnowledgeImportInput,
  CompanionRemoteDirectoryInput,
  CompanionRuntime,
  CompanionScheduledTaskInput,
  CompanionScheduledTaskUpdateInput,
  CompanionSshTargetSaveInput,
  CompanionSshTargetTestInput,
  CompanionSurfaceType,
} from '@neon-pilot/daemon';

import { parseApiDispatchResult, readApiDispatchError } from '../hosts/api-dispatch.js';
import type { HostManager } from '../hosts/host-manager.js';
import type { DesktopApiStreamEvent } from '../hosts/types.js';

function toQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 0) {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}

function toInternalSurfaceType(surfaceType: CompanionSurfaceType | undefined): 'desktop_web' | 'mobile_web' | undefined {
  if (surfaceType === 'desktop_ui') {
    return 'desktop_web';
  }

  if (surfaceType === 'ios_native') {
    return 'mobile_web';
  }

  return undefined;
}

async function dispatchDesktopApi(
  hostManager: HostManager,
  input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
) {
  return hostManager.getHostController('local').dispatchApiRequest(input);
}

async function invokeDesktopApi<T = unknown>(
  hostManager: HostManager,
  input: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const response = await dispatchDesktopApi(hostManager, input);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(readApiDispatchError(response));
  }

  return parseApiDispatchResult<T>(response);
}

async function invokeDesktopExtensionAction<T = unknown>(
  hostManager: HostManager,
  extensionId: string,
  actionId: string,
  input: unknown,
): Promise<T> {
  const response = await invokeDesktopApi<{ ok?: boolean; result?: T; error?: string }>(hostManager, {
    method: 'POST',
    path: `/api/extensions/${encodeURIComponent(extensionId)}/actions/${encodeURIComponent(actionId)}`,
    body: input,
  });
  if (response.ok === false) {
    throw new Error(response.error || `Extension action failed: ${extensionId}.${actionId}`);
  }
  return response.result as T;
}

async function resolveDesktopExtensionIdByRouteCapability(hostManager: HostManager, capability: string, actionId: string): Promise<string> {
  const extensions = await invokeDesktopApi<
    Array<{
      id: string;
      enabled?: boolean;
      manifest?: {
        backend?: { actions?: Array<{ id: string }> };
        contributes?: { views?: Array<{ routeCapabilities?: string[] }> };
      };
      surfaces?: Array<{ routeCapabilities?: string[] }>;
      backendActions?: Array<{ id: string }>;
    }>
  >(hostManager, { method: 'GET', path: '/api/extensions/installed' });
  const extension = extensions.find(
    (candidate) =>
      candidate.enabled !== false &&
      (candidate.manifest?.contributes?.views?.some((view) => view.routeCapabilities?.includes(capability)) ||
        candidate.surfaces?.some((surface) => surface.routeCapabilities?.includes(capability))) &&
      (candidate.backendActions ?? candidate.manifest?.backend?.actions ?? []).some((action) => action.id === actionId),
  );
  if (!extension) throw new Error(`No enabled extension provides ${capability}.${actionId}.`);
  return extension.id;
}

async function invokeDesktopExtensionActionByRouteCapability<T = unknown>(
  hostManager: HostManager,
  capability: string,
  actionId: string,
  input: unknown,
): Promise<T> {
  const extensionId = await resolveDesktopExtensionIdByRouteCapability(hostManager, capability, actionId);
  return invokeDesktopExtensionAction<T>(hostManager, extensionId, actionId, input);
}

async function subscribeDesktopApiStream(
  hostManager: HostManager,
  path: string,
  onEvent: (event: DesktopApiStreamEvent) => void,
): Promise<() => void> {
  return hostManager.getHostController('local').subscribeApiStream(path, onEvent);
}

const COMPANION_TRANSCRIPT_TAIL_BLOCKS = 10000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDataUrlAsset(input: unknown): CompanionBinaryAsset {
  const candidate = input && typeof input === 'object' ? (input as { dataUrl?: unknown; mimeType?: unknown; fileName?: unknown }) : {};
  const dataUrl = typeof candidate.dataUrl === 'string' ? candidate.dataUrl.trim() : '';
  const mimeType =
    typeof candidate.mimeType === 'string' && candidate.mimeType.trim().length > 0 ? candidate.mimeType.trim() : 'application/octet-stream';
  const fileName = typeof candidate.fileName === 'string' && candidate.fileName.trim().length > 0 ? candidate.fileName.trim() : undefined;

  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.*)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Attachment asset payload is malformed.');
  }

  return {
    data: Buffer.from(match[2] || '', 'base64'),
    mimeType,
    ...(fileName ? { fileName } : {}),
    disposition: mimeType.startsWith('image/') ? 'inline' : 'attachment',
  };
}

function buildCompanionConversationBlockImagePath(conversationId: string, blockId: string, imageIndex?: number): string {
  const encodedConversationId = encodeURIComponent(conversationId);
  const encodedBlockId = encodeURIComponent(blockId);
  return typeof imageIndex === 'number'
    ? `/companion/v1/conversations/${encodedConversationId}/blocks/${encodedBlockId}/images/${String(imageIndex)}`
    : `/companion/v1/conversations/${encodedConversationId}/blocks/${encodedBlockId}/image`;
}

function normalizeConversationBlockForCompanion(conversationId: string, block: unknown): unknown {
  if (!isRecord(block)) {
    return block;
  }

  const blockType = typeof block.type === 'string' ? block.type : '';
  const blockId = typeof block.id === 'string' ? block.id.trim() : '';

  if (blockType === 'user' && Array.isArray(block.images) && blockId) {
    return {
      ...block,
      images: block.images.map((image, imageIndex) =>
        isRecord(image) ? { ...image, src: buildCompanionConversationBlockImagePath(conversationId, blockId, imageIndex) } : image,
      ),
    };
  }

  if (blockType === 'image' && blockId) {
    return {
      ...block,
      src: buildCompanionConversationBlockImagePath(conversationId, blockId),
    };
  }

  return block;
}

function normalizeConversationBlocksForCompanion(conversationId: string, blocks: unknown): unknown {
  if (!Array.isArray(blocks)) {
    return blocks;
  }

  return blocks.map((block) => normalizeConversationBlockForCompanion(conversationId, block));
}

function normalizeCompanionTranscriptTailBlocks(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return COMPANION_TRANSCRIPT_TAIL_BLOCKS;
  }

  return Math.max(value, COMPANION_TRANSCRIPT_TAIL_BLOCKS);
}

function normalizeConversationBootstrapForCompanion(conversationId: string, envelope: unknown): unknown {
  if (!isRecord(envelope) || !isRecord(envelope.bootstrap)) {
    return envelope;
  }

  const bootstrap = envelope.bootstrap;
  const sessionDetail = isRecord(bootstrap.sessionDetail)
    ? {
        ...bootstrap.sessionDetail,
        blocks: normalizeConversationBlocksForCompanion(conversationId, bootstrap.sessionDetail.blocks),
      }
    : bootstrap.sessionDetail;
  const sessionDetailAppendOnly = isRecord(bootstrap.sessionDetailAppendOnly)
    ? {
        ...bootstrap.sessionDetailAppendOnly,
        blocks: normalizeConversationBlocksForCompanion(conversationId, bootstrap.sessionDetailAppendOnly.blocks),
      }
    : bootstrap.sessionDetailAppendOnly;

  return {
    ...envelope,
    bootstrap: {
      ...bootstrap,
      sessionDetail,
      sessionDetailAppendOnly,
    },
  };
}

function normalizeConversationEventForCompanion(conversationId: string, event: unknown): unknown {
  if (!isRecord(event)) {
    return event;
  }

  if (event.type === 'snapshot') {
    return {
      ...event,
      blocks: normalizeConversationBlocksForCompanion(conversationId, event.blocks),
    };
  }

  if (event.type === 'user_message' && isRecord(event.block)) {
    return {
      ...event,
      block: normalizeConversationBlockForCompanion(conversationId, event.block),
    };
  }

  return event;
}

function buildExecutionTargets(_hostManager: HostManager) {
  return [{ id: 'local', label: 'Local', kind: 'local' as const }];
}

async function buildConversationListState(hostManager: HostManager) {
  const localController = hostManager.getHostController('local');
  const [sessions, ordering] = await Promise.all([
    localController.readSessions?.() ?? Promise.resolve([]),
    localController.readOpenConversationTabs?.() ??
      Promise.resolve({
        sessionIds: [],
        pinnedSessionIds: [],
        archivedSessionIds: [],
        workspacePaths: [],
      }),
  ]);

  return {
    sessions,
    ordering,
    executionTargets: buildExecutionTargets(hostManager),
  };
}

async function restoreConversationToSharedLayout(
  localController: Pick<ReturnType<HostManager['getHostController']>, 'readOpenConversationTabs' | 'updateOpenConversationTabs'>,
  conversationId: string,
): Promise<void> {
  const currentLayout = await localController.readOpenConversationTabs?.().catch(() => null);
  if (!localController.updateOpenConversationTabs || !isRecord(currentLayout)) {
    return;
  }

  const sessionIds = Array.isArray(currentLayout.sessionIds)
    ? currentLayout.sessionIds.filter((id): id is string => typeof id === 'string')
    : [];
  const pinnedSessionIds = Array.isArray(currentLayout.pinnedSessionIds)
    ? currentLayout.pinnedSessionIds.filter((id): id is string => typeof id === 'string')
    : [];
  const archivedSessionIds = Array.isArray(currentLayout.archivedSessionIds)
    ? currentLayout.archivedSessionIds.filter((id): id is string => typeof id === 'string' && id !== conversationId)
    : [];
  const workspacePaths = Array.isArray(currentLayout.workspacePaths)
    ? currentLayout.workspacePaths.filter((path): path is string => typeof path === 'string')
    : [];

  await localController
    .updateOpenConversationTabs({
      sessionIds: [conversationId, ...sessionIds.filter((id) => id !== conversationId)],
      pinnedSessionIds,
      archivedSessionIds,
      workspacePaths,
    })
    .catch(() => undefined);
}

export function createDesktopCompanionRuntime(hostManager: HostManager): CompanionRuntime {
  return {
    async listConversations() {
      return buildConversationListState(hostManager);
    },

    async updateConversationTabs(input: CompanionConversationTabsUpdateInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.updateOpenConversationTabs) {
        throw new Error('Conversation layout updates are unavailable.');
      }

      return localController.updateOpenConversationTabs(input);
    },

    async duplicateConversation(input: CompanionConversationDuplicateInput) {
      return invokeDesktopApi(hostManager, {
        method: 'POST',
        path: `/api/conversations/${encodeURIComponent(input.conversationId)}/duplicate`,
      });
    },

    async listExecutionTargets() {
      return {
        executionTargets: buildExecutionTargets(hostManager),
      };
    },

    async readModels() {
      const localController = hostManager.getHostController('local');
      if (localController.readModels) {
        return localController.readModels();
      }

      throw new Error('Local desktop model capability is unavailable.');
    },

    async listSshTargets() {
      return { hosts: [] };
    },

    async saveSshTarget(_input: CompanionSshTargetSaveInput) {
      throw new Error('SSH targets are unavailable in this desktop build.');
    },

    async deleteSshTarget(_targetId: string) {
      throw new Error('SSH targets are unavailable in this desktop build.');
    },

    async testSshTarget(_input: CompanionSshTargetTestInput) {
      throw new Error('SSH targets are unavailable in this desktop build.');
    },

    async readRemoteDirectory(input: CompanionRemoteDirectoryInput) {
      if (input.executionTargetId !== 'local') {
        throw new Error('Only the local execution target is available.');
      }
      return invokeDesktopApi(hostManager, {
        method: 'GET',
        path: `/api/files/tree${input.path ? `?path=${encodeURIComponent(input.path)}` : ''}`,
      });
    },

    async readConversationBootstrap(input: CompanionConversationBootstrapInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationBootstrap) {
        throw new Error('Local conversation bootstrap capability is unavailable.');
      }

      const [bootstrap, sessionMeta, attachments, executionTargets] = await Promise.all([
        localController.readConversationBootstrap({
          conversationId: input.conversationId,
          tailBlocks: normalizeCompanionTranscriptTailBlocks(input.tailBlocks),
        }),
        localController.readSessionMeta?.(input.conversationId).catch(() => null) ?? Promise.resolve(null),
        localController.readConversationAttachments?.(input.conversationId).catch(() => null) ?? Promise.resolve(null),
        Promise.resolve(buildExecutionTargets(hostManager)),
      ]);

      return normalizeConversationBootstrapForCompanion(input.conversationId, {
        bootstrap,
        sessionMeta,
        attachments,
        executionTargets,
      });
    },

    async createConversation(input: CompanionConversationCreateInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.createLiveSession) {
        throw new Error('Local conversation creation is unavailable.');
      }

      const created = await localController.createLiveSession({
        cwd: input.cwd,
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.thinkingLevel !== undefined ? { thinkingLevel: input.thinkingLevel } : {}),
        ...(input.serviceTier !== undefined ? { serviceTier: input.serviceTier } : {}),
      });

      const conversationId = created.id;
      if (input.executionTargetId && input.executionTargetId !== 'local') {
        throw new Error('Only the local execution target is available.');
      }

      if (input.prompt && (input.prompt.text?.trim() || (input.prompt.images?.length ?? 0) > 0)) {
        await this.promptConversation({
          conversationId,
          text: input.prompt.text,
          behavior: input.prompt.behavior,
          images: input.prompt.images,
          attachmentRefs: input.prompt.attachmentRefs,
          contextMessages: input.prompt.contextMessages,
          surfaceId: input.prompt.surfaceId,
        });
      }

      await restoreConversationToSharedLayout(localController, conversationId);

      return this.readConversationBootstrap({ conversationId, tailBlocks: COMPANION_TRANSCRIPT_TAIL_BLOCKS });
    },

    async resumeConversation(input: CompanionConversationResumeInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.resumeLiveSession) {
        throw new Error('Local conversation resume is unavailable.');
      }

      const resumed = await localController.resumeLiveSession({
        sessionFile: input.sessionFile,
        ...(input.cwd ? { cwd: input.cwd } : {}),
      });

      if (input.executionTargetId && input.executionTargetId !== 'local') {
        throw new Error('Only the local execution target is available.');
      }

      await restoreConversationToSharedLayout(localController, resumed.id);

      return this.readConversationBootstrap({ conversationId: resumed.id, tailBlocks: COMPANION_TRANSCRIPT_TAIL_BLOCKS });
    },

    async promptConversation(input: CompanionConversationPromptInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.submitLiveSessionPrompt) {
        throw new Error('Local live-session prompt capability is unavailable.');
      }
      return localController.submitLiveSessionPrompt(input);
    },

    async restoreConversationQueuePrompt(input: CompanionConversationQueueRestoreInput) {
      const localController = hostManager.getHostController('local');
      if (localController.restoreQueuedLiveSessionMessage) {
        return localController.restoreQueuedLiveSessionMessage(input);
      }

      throw new Error('Local live-session queue restore capability is unavailable.');
    },

    async abortConversation(input: CompanionConversationAbortInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.abortLiveSession) {
        throw new Error('Local live-session abort capability is unavailable.');
      }
      return localController.abortLiveSession(input.conversationId);
    },

    async takeOverConversation(input: CompanionConversationTakeoverInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.takeOverLiveSession) {
        throw new Error('Local live-session takeover capability is unavailable.');
      }
      return localController.takeOverLiveSession(input);
    },

    async renameConversation(input: CompanionConversationRenameInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.renameConversation) {
        throw new Error('Local conversation rename capability is unavailable.');
      }
      return localController.renameConversation(input);
    },

    async changeConversationCwd(input: CompanionConversationCwdChangeInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.changeConversationCwd) {
        throw new Error('Local conversation cwd capability is unavailable.');
      }
      return localController.changeConversationCwd(input);
    },

    async readConversationAutoMode(conversationId: string) {
      return invokeDesktopApi(hostManager, {
        method: 'GET',
        path: `/api/conversations/${encodeURIComponent(conversationId)}/auto-mode`,
      });
    },

    async updateConversationAutoMode(input: { conversationId: string; enabled: boolean; surfaceId?: string }) {
      return invokeDesktopApi(hostManager, {
        method: 'PATCH',
        path: `/api/conversations/${encodeURIComponent(input.conversationId)}/auto-mode`,
        body: {
          enabled: input.enabled,
          ...(input.surfaceId ? { surfaceId: input.surfaceId } : {}),
        },
      });
    },

    async readConversationModelPreferences(conversationId: string) {
      const localController = hostManager.getHostController('local');
      if (localController.readConversationModelPreferences) {
        return localController.readConversationModelPreferences({ conversationId });
      }

      throw new Error('Local conversation model-preferences capability is unavailable.');
    },

    async updateConversationModelPreferences(input: CompanionConversationModelPreferencesUpdateInput) {
      const localController = hostManager.getHostController('local');
      if (localController.updateConversationModelPreferences) {
        return localController.updateConversationModelPreferences(input);
      }

      throw new Error('Local conversation model-preferences update capability is unavailable.');
    },

    async createConversationCheckpoint(input: CompanionConversationCheckpointCreateInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.createConversationCheckpoint) {
        throw new Error('Conversation checkpoint creation is unavailable.');
      }
      return localController.createConversationCheckpoint({
        conversationId: input.conversationId,
        message: input.message,
        paths: input.paths,
      });
    },

    async listConversationArtifacts(conversationId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationArtifacts) {
        throw new Error('Conversation artifacts are unavailable.');
      }

      return localController.readConversationArtifacts(conversationId);
    },

    async readConversationArtifact(input: { conversationId: string; artifactId: string }) {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationArtifact) {
        throw new Error('Conversation artifacts are unavailable.');
      }

      return localController.readConversationArtifact(input);
    },

    async listConversationCheckpoints(conversationId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationCheckpoints) {
        throw new Error('Conversation checkpoints are unavailable.');
      }

      return localController.readConversationCheckpoints(conversationId);
    },

    async readConversationCheckpoint(input: { conversationId: string; checkpointId: string }) {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationCheckpoint) {
        throw new Error('Conversation checkpoints are unavailable.');
      }

      return localController.readConversationCheckpoint(input);
    },

    async changeConversationExecutionTarget(input: CompanionConversationExecutionTargetChangeInput) {
      if (input.executionTargetId !== 'local') {
        throw new Error('Only the local execution target is available.');
      }
      if (input.cwd !== undefined && input.cwd !== null) {
        await this.changeConversationCwd({ conversationId: input.conversationId, cwd: input.cwd });
      }
      return this.readConversationBootstrap({ conversationId: input.conversationId, tailBlocks: COMPANION_TRANSCRIPT_TAIL_BLOCKS });
    },

    async listConversationForkEntries(conversationId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.readLiveSessionForkEntries) {
        throw new Error('Local live-session fork-entry capability is unavailable.');
      }
      return localController.readLiveSessionForkEntries(conversationId);
    },

    async forkConversation(input: CompanionConversationForkInput) {
      const localController = hostManager.getHostController('local');
      if (localController.forkLiveSession) {
        const result = await localController.forkLiveSession({
          conversationId: input.conversationId,
          entryId: input.entryId,
          beforeEntry: input.beforeEntry,
          preserveSource: input.preserveSource,
        });
        return this.readConversationBootstrap({ conversationId: result.newSessionId, tailBlocks: COMPANION_TRANSCRIPT_TAIL_BLOCKS });
      }

      throw new Error('Local live-session fork capability is unavailable.');
    },

    async branchConversation(input: CompanionConversationBranchInput) {
      const localController = hostManager.getHostController('local');
      if (localController.branchLiveSession) {
        const result = await localController.branchLiveSession({
          conversationId: input.conversationId,
          entryId: input.entryId,
        });
        return this.readConversationBootstrap({ conversationId: result.newSessionId, tailBlocks: COMPANION_TRANSCRIPT_TAIL_BLOCKS });
      }

      throw new Error('Local live-session branch capability is unavailable.');
    },

    async readConversationBlockImage(input: CompanionConversationBlockImageInput): Promise<CompanionBinaryAsset> {
      const response = await dispatchDesktopApi(hostManager, {
        method: 'GET',
        path:
          typeof input.imageIndex === 'number'
            ? `/api/sessions/${encodeURIComponent(input.conversationId)}/blocks/${encodeURIComponent(input.blockId)}/images/${String(input.imageIndex)}`
            : `/api/sessions/${encodeURIComponent(input.conversationId)}/blocks/${encodeURIComponent(input.blockId)}/image`,
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(readApiDispatchError(response));
      }

      const mimeType =
        typeof response.headers['content-type'] === 'string' && response.headers['content-type'].trim().length > 0
          ? (response.headers['content-type'].trim().split(';')[0] ?? 'application/octet-stream')
          : 'application/octet-stream';

      return {
        data: response.body,
        mimeType,
        disposition: 'inline',
      };
    },

    async listConversationAttachments(conversationId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationAttachments) {
        throw new Error('Conversation attachments are unavailable.');
      }

      return localController.readConversationAttachments(conversationId);
    },

    async readConversationAttachment(input: { conversationId: string; attachmentId: string }) {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationAttachment) {
        throw new Error('Conversation attachment reads are unavailable.');
      }

      return localController.readConversationAttachment(input);
    },

    async createConversationAttachment(input: CompanionAttachmentCreateInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.createConversationAttachment) {
        throw new Error('Conversation attachments are unavailable.');
      }

      return localController.createConversationAttachment(input);
    },

    async updateConversationAttachment(input: CompanionAttachmentUpdateInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.updateConversationAttachment) {
        throw new Error('Conversation attachments are unavailable.');
      }

      return localController.updateConversationAttachment(input);
    },

    async readConversationAttachmentAsset(input: CompanionAttachmentAssetInput): Promise<CompanionBinaryAsset> {
      const localController = hostManager.getHostController('local');
      if (!localController.readConversationAttachmentAsset) {
        throw new Error('Conversation attachment assets are unavailable.');
      }

      return parseDataUrlAsset(await localController.readConversationAttachmentAsset(input));
    },

    async listKnowledgeEntries(directoryId?: string | null) {
      return invokeDesktopExtensionActionByRouteCapability(
        hostManager,
        'knowledgeFiles',
        'vaultTree',
        directoryId ? { dir: directoryId } : {},
      );
    },

    async searchKnowledge(input: { query?: string | null; limit?: number | null }) {
      const query = input.query?.trim() ?? '';
      const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20) || 20));
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultSearch', { q: query, limit });
    },

    async readKnowledgeFile(fileId: string) {
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultReadFile', { id: fileId });
    },

    async writeKnowledgeFile(input: { fileId: string; content: string }) {
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultWriteFile', {
        id: input.fileId,
        content: input.content,
      });
    },

    async createKnowledgeFolder(folderId: string) {
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultCreateFolder', { id: folderId });
    },

    async renameKnowledgeEntry(input: { id: string; newName: string }) {
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultRename', input);
    },

    async deleteKnowledgeEntry(id: string) {
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultDeleteFile', { id });
    },

    async createKnowledgeImageAsset(input: { fileName?: string | null; mimeType?: string | null; dataBase64: string }) {
      const safeFileName = input.fileName?.trim() || 'image.png';
      const mimeType = input.mimeType?.trim() || 'image/png';
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultUploadImage', {
        filename: safeFileName,
        dataUrl: `data:${mimeType};base64,${input.dataBase64.trim()}`,
      });
    },

    async importKnowledge(input: CompanionKnowledgeImportInput) {
      return invokeDesktopExtensionActionByRouteCapability(hostManager, 'knowledgeFiles', 'vaultImportSharedItem', input);
    },

    async listScheduledTasks() {
      const localController = hostManager.getHostController('local');
      if (!localController.readScheduledTasks) {
        throw new Error('Scheduled tasks are unavailable.');
      }

      return localController.readScheduledTasks();
    },

    async readScheduledTask(taskId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.readScheduledTaskDetail) {
        throw new Error('Scheduled tasks are unavailable.');
      }

      return localController.readScheduledTaskDetail(taskId);
    },

    async readScheduledTaskLog(taskId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.readScheduledTaskLog) {
        throw new Error('Scheduled task logs are unavailable.');
      }

      return localController.readScheduledTaskLog(taskId);
    },

    async createScheduledTask(input: CompanionScheduledTaskInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.createScheduledTask) {
        throw new Error('Scheduled tasks are unavailable.');
      }

      return localController.createScheduledTask(input);
    },

    async updateScheduledTask(input: CompanionScheduledTaskUpdateInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.updateScheduledTask) {
        throw new Error('Scheduled tasks are unavailable.');
      }

      return localController.updateScheduledTask(input);
    },

    async deleteScheduledTask(taskId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.deleteScheduledTask) {
        throw new Error('Scheduled tasks are unavailable.');
      }

      return localController.deleteScheduledTask(taskId);
    },

    async runScheduledTask(taskId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.runScheduledTask) {
        throw new Error('Scheduled tasks are unavailable.');
      }

      return localController.runScheduledTask(taskId);
    },

    async listDurableRuns() {
      const localController = hostManager.getHostController('local');
      if (!localController.readDurableRuns) {
        throw new Error('Durable runs are unavailable.');
      }

      return localController.readDurableRuns();
    },

    async readDurableRun(runId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.readDurableRun) {
        throw new Error('Durable runs are unavailable.');
      }

      return localController.readDurableRun(runId);
    },

    async readDurableRunLog(input: CompanionDurableRunLogInput) {
      const localController = hostManager.getHostController('local');
      if (!localController.readDurableRunLog) {
        throw new Error('Durable run logs are unavailable.');
      }

      return localController.readDurableRunLog(input);
    },

    async cancelDurableRun(runId: string) {
      const localController = hostManager.getHostController('local');
      if (!localController.cancelDurableRun) {
        throw new Error('Durable runs are unavailable.');
      }

      return localController.cancelDurableRun(runId);
    },

    async subscribeApp(onEvent: (event: unknown) => void) {
      const localController = hostManager.getHostController('local');
      if (!localController.subscribeDesktopAppEvents) {
        throw new Error('Desktop app event subscriptions are unavailable.');
      }

      onEvent({ type: 'open' });
      return localController.subscribeDesktopAppEvents(async (event) => {
        if (event.type === 'error') {
          onEvent({ type: 'error', message: event.message });
          return;
        }

        if (event.type === 'close') {
          onEvent({ type: 'close' });
          return;
        }

        if (event.type === 'open') {
          onEvent({ type: 'open' });
          return;
        }

        onEvent({
          type: 'conversation_list_changed',
          sourceEvent: event.event,
        });
      });
    },

    async subscribeConversation(input: CompanionConversationSubscriptionInput, onEvent: (event: unknown) => void) {
      const query = toQuery({
        ...(input.surfaceId ? { surfaceId: input.surfaceId } : {}),
        ...(toInternalSurfaceType(input.surfaceType) ? { surfaceType: toInternalSurfaceType(input.surfaceType) } : {}),
        tailBlocks: String(normalizeCompanionTranscriptTailBlocks(input.tailBlocks)),
      });

      return subscribeDesktopApiStream(
        hostManager,
        `/api/live-sessions/${encodeURIComponent(input.conversationId)}/events${query}`,
        (event) => {
          if (event.type === 'message') {
            try {
              const payload = JSON.parse(event.data || 'null') as unknown;
              onEvent(normalizeConversationEventForCompanion(input.conversationId, payload));
            } catch (error) {
              onEvent({ type: 'error', message: error instanceof Error ? error.message : String(error) });
            }
            return;
          }

          if (event.type === 'error') {
            onEvent({ type: 'error', message: event.message });
            return;
          }

          if (event.type === 'close') {
            onEvent({ type: 'close' });
          }
        },
      );
    },
  };
}
