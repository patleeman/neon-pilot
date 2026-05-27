import { describe, expect, it } from 'vitest';

import * as runtime from './index.js';

describe('core runtime barrel', () => {
  it('reexports runtime path helpers, bootstrap helpers, and agent dir preparation', () => {
    expect(runtime).toEqual(
      expect.objectContaining({
        getConfigRoot: expect.any(Function),
        getDefaultKnowledgeRoot: expect.any(Function),
        getDefaultStateRoot: expect.any(Function),
        getDurableAgentFilePath: expect.any(Function),
        getDurableSessionsDir: expect.any(Function),
        getDurableSkillsDir: expect.any(Function),
        getPiAgentRuntimeDir: expect.any(Function),
        getStateRoot: expect.any(Function),
        getSyncRoot: expect.any(Function),
        getKnowledgeRoot: expect.any(Function),
        isPathInRepo: expect.any(Function),
        resolveNeutralChatCwd: expect.any(Function),
        resolveStatePaths: expect.any(Function),
        validateStatePathsOutsideRepo: expect.any(Function),
        bootstrapState: expect.any(Function),
        bootstrapStateOrThrow: expect.any(Function),
        canBootstrap: expect.any(Function),
        preparePiAgentDir: expect.any(Function),
      }),
    );
  });
});
