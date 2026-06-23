import { getRuntimeSettingsFilePath } from '../ui/settingsPersistence.js';
import { readSavedUiPreferences, writeSavedUiPreferences } from '../ui/uiPreferences.js';

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

export function openAutomationOwnerThread(input: { conversationId?: string; stateRoot?: string }): boolean {
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
    settingsFile,
  );
  return true;
}
