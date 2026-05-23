import { describe, expect, it } from 'vitest';

import { buildDesktopOpenConversationTabsResponse } from './localApiOpenTabsPresentation';

describe('localApiOpenTabsPresentation', () => {
  it('maps saved UI preferences to the desktop open tabs response', () => {
    expect(
      buildDesktopOpenConversationTabsResponse({
        openConversationIds: ['a'],
        pinnedConversationIds: ['b'],
        archivedConversationIds: ['c'],
        activeConversationId: 'a',
        workspacePaths: ['/tmp'],
        remoteControlledConversationIds: ['d'],
      }),
    ).toEqual({
      sessionIds: ['a'],
      pinnedSessionIds: ['b'],
      archivedSessionIds: ['c'],
      activeConversationId: 'a',
      workspacePaths: ['/tmp'],
      remoteControlledConversationIds: ['d'],
    });
  });

  it('normalizes missing active conversation to null', () => {
    expect(
      buildDesktopOpenConversationTabsResponse({
        openConversationIds: [],
        pinnedConversationIds: [],
        archivedConversationIds: [],
        workspacePaths: [],
        remoteControlledConversationIds: [],
      }).activeConversationId,
    ).toBeNull();
  });
});
