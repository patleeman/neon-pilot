import { invalidateAppTopics, publishAppEvent } from '../shared/appEvents.js';
import { getRuntimeSettingsFilePath, persistSettingsWrite } from '../ui/settingsPersistence.js';
import { readSavedUiPreferences, type SavedUiPreferences, writeSavedUiPreferences } from '../ui/uiPreferences.js';

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

export function openAutomationOwnerThread(input: { conversationId?: string; stateRoot?: string; localRuntimeConfigDir?: string }): boolean {
  const conversationId = input.conversationId?.trim();
  if (!conversationId) {
    return false;
  }

  const settingsFile = getRuntimeSettingsFilePath(input.stateRoot);
  const current = readSavedUiPreferences(settingsFile);
  const pinned = new Set(current.pinnedConversationIds);
  const alreadyVisible = pinned.has(conversationId) || current.openConversationIds.includes(conversationId);
  const archived = current.archivedConversationIds.includes(conversationId);
  if (alreadyVisible && !archived) {
    return false;
  }

  const saved = persistSettingsWrite(
    (targetSettingsFile) =>
      writeSavedUiPreferences(
        {
          openConversationIds: pinned.has(conversationId)
            ? current.openConversationIds
            : unique([...current.openConversationIds, conversationId]),
          pinnedConversationIds: current.pinnedConversationIds,
          archivedConversationIds: current.archivedConversationIds.filter((id) => id !== conversationId),
          lockedConversationIds: current.lockedConversationIds,
          activeConversationId: current.activeConversationId,
          workspacePaths: current.workspacePaths,
          remoteControlledConversationIds: current.remoteControlledConversationIds,
          nodeBrowserViews: current.nodeBrowserViews,
        },
        targetSettingsFile,
      ),
    { runtimeSettingsFile: settingsFile, localRuntimeConfigDir: input.localRuntimeConfigDir },
  );
  publishAutomationOwnerThreadWorkspaceChanged(saved);
  return true;
}

function publishAutomationOwnerThreadWorkspaceChanged(saved: SavedUiPreferences): void {
  invalidateAppTopics('sessions', 'workspace');
  publishAppEvent({
    type: 'conversation_workspace_changed',
    sessionIds: saved.openConversationIds,
    pinnedSessionIds: saved.pinnedConversationIds,
    archivedSessionIds: saved.archivedConversationIds,
    conversationPlacements: Object.fromEntries([
      ...saved.openConversationIds.map((id) => [id, 'open'] as const),
      ...saved.pinnedConversationIds.map((id) => [id, 'pinned'] as const),
      ...saved.archivedConversationIds.map((id) => [id, 'archived'] as const),
    ]),
    activeConversationId: saved.activeConversationId ?? null,
    workspacePaths: saved.workspacePaths,
    remoteControlledConversationIds: saved.remoteControlledConversationIds,
    conversationWorkspaceRevision: saved.conversationWorkspaceRevision,
    conversationWorkspaceUpdatedAt: saved.conversationWorkspaceUpdatedAt,
    conversationWorkspaceMigratedAt: saved.conversationWorkspaceMigratedAt,
  });
}
