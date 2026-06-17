import { describe, expect, it } from 'vitest';

import * as artifactApi from './artifacts.js';
import * as checkpointApi from './checkpoints.js';
import * as imageApi from './images.js';

describe('backend api reexports', () => {
  it('reexports conversation artifact operations', () => {
    expect(artifactApi).toEqual(
      expect.objectContaining({
        deleteConversationArtifact: expect.any(Function),
        getConversationArtifact: expect.any(Function),
        listConversationArtifacts: expect.any(Function),
        saveConversationArtifact: expect.any(Function),
      }),
    );
  });

  it('reexports conversation checkpoint operations', () => {
    expect(checkpointApi).toEqual(
      expect.objectContaining({
        getConversationCommitCheckpoint: expect.any(Function),
        listConversationCommitCheckpoints: expect.any(Function),
        saveConversationCommitCheckpoint: expect.any(Function),
      }),
    );
  });

  it('reexports image probe attachment store operations', () => {
    expect(imageApi).toEqual(
      expect.objectContaining({
        clearImageProbeAttachmentCacheForTests: expect.any(Function),
        getImageProbeAttachments: expect.any(Function),
        getImageProbeAttachmentsById: expect.any(Function),
        getImageProbeAttachmentsByIdFromAnySession: expect.any(Function),
        rememberImageProbeAttachments: expect.any(Function),
      }),
    );
  });
});
