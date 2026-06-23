import { getStateRoot } from '@neon-pilot/core';

import { setConversationServiceContext } from '../../server/conversations/conversationService.js';
import { getRuntimeSettingsFilePath } from '../../server/ui/settingsPersistence.js';
import { readSavedUiPreferences } from '../../server/ui/uiPreferences.js';

export const SHARED_CHILD_RUNTIME_SCOPE = 'shared';

function getRepoRoot(): string {
  return process.env.NEON_PILOT_REPO_ROOT?.trim() || process.cwd();
}

function getSettingsFile(): string {
  return getRuntimeSettingsFilePath(getStateRoot());
}

export function installSharedConversationServiceContext(): void {
  setConversationServiceContext({
    getRuntimeScope: () => SHARED_CHILD_RUNTIME_SCOPE,
    getRepoRoot,
    getSettingsFile,
    getSavedUiPreferences: () => readSavedUiPreferences(getSettingsFile()),
  });
}
