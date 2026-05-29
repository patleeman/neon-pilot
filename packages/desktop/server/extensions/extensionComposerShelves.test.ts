import { describe, expect, it } from 'vitest';

import { listExtensionComposerShelfRegistrations, listExtensionNewConversationPanelRegistrations } from './extensionRegistry.js';

describe('extension composer shelves', () => {
  it('does not surface installable suggested context until it is installed', () => {
    expect(listExtensionNewConversationPanelRegistrations()).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ extensionId: 'system-suggested-context' })]),
    );
    expect(listExtensionComposerShelfRegistrations()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ extensionId: 'system-suggested-context' })]),
    );
  });

  it('does not surface global scheduled task counts in conversation composers', () => {
    expect(listExtensionComposerShelfRegistrations()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ extensionId: 'system-automations' })]),
    );
  });
});
