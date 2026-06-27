import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { type AppEvent,subscribeAppEvents } from '../shared/appEvents.js';
import { getRuntimeSettingsFilePath } from '../ui/settingsPersistence.js';
import { readSavedUiPreferences, writeSavedUiPreferences } from '../ui/uiPreferences.js';
import { openAutomationOwnerThread } from './workspace.js';

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('automation owner thread workspace', () => {
  it('reopens a closed owner thread and publishes the sidebar workspace update', () => {
    const stateRoot = createTempDir('automation-workspace-');
    const settingsFile = getRuntimeSettingsFilePath(stateRoot);
    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => events.push(event));

    try {
      expect(openAutomationOwnerThread({ conversationId: 'conv-owner', stateRoot })).toBe(true);

      const saved = readSavedUiPreferences(settingsFile);
      expect(saved.openConversationIds).toEqual(['conv-owner']);
      expect(saved.archivedConversationIds).toEqual([]);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'invalidate', topics: expect.arrayContaining(['sessions', 'workspace']) }),
          expect.objectContaining({
            type: 'conversation_workspace_changed',
            sessionIds: ['conv-owner'],
            archivedSessionIds: [],
            conversationPlacements: expect.objectContaining({ 'conv-owner': 'open' }),
          }),
        ]),
      );
    } finally {
      unsubscribe();
    }
  });

  it('restores an archived owner thread before an automation run can hide in the archive', () => {
    const stateRoot = createTempDir('automation-workspace-');
    const settingsFile = getRuntimeSettingsFilePath(stateRoot);
    writeSavedUiPreferences(
      {
        openConversationIds: ['already-open'],
        archivedConversationIds: ['conv-owner'],
        activeConversationId: 'already-open',
        conversationWorkspaceMigrated: true,
      },
      settingsFile,
    );
    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => events.push(event));

    try {
      expect(openAutomationOwnerThread({ conversationId: 'conv-owner', stateRoot })).toBe(true);

      const saved = readSavedUiPreferences(settingsFile);
      expect(saved.openConversationIds).toEqual(['already-open', 'conv-owner']);
      expect(saved.archivedConversationIds).toEqual([]);
      expect(saved.activeConversationId).toBe('already-open');
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'conversation_workspace_changed',
            sessionIds: ['already-open', 'conv-owner'],
            archivedSessionIds: [],
            activeConversationId: 'already-open',
            conversationPlacements: expect.objectContaining({ 'conv-owner': 'open' }),
          }),
        ]),
      );
    } finally {
      unsubscribe();
    }
  });

  it('does not republish when the owner thread is already visible', () => {
    const stateRoot = createTempDir('automation-workspace-');
    const settingsFile = getRuntimeSettingsFilePath(stateRoot);
    writeSavedUiPreferences({ openConversationIds: ['conv-owner'], conversationWorkspaceMigrated: true }, settingsFile);
    const events: AppEvent[] = [];
    const unsubscribe = subscribeAppEvents((event) => events.push(event));

    try {
      expect(openAutomationOwnerThread({ conversationId: 'conv-owner', stateRoot })).toBe(false);
      expect(events).toEqual([]);
    } finally {
      unsubscribe();
    }
  });
});
