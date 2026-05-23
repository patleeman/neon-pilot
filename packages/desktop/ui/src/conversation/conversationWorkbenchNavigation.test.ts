import { describe, expect, it } from 'vitest';

import { buildOpenArtifactSearch, buildOpenKnowledgeFileSearch } from './conversationWorkbenchNavigation';

describe('conversationWorkbenchNavigation', () => {
  it('opens artifacts while clearing checkpoint selection', () => {
    expect(buildOpenArtifactSearch('?checkpoint=abc&artifact=old&run=run-1', 'artifact-1')).toBe('?artifact=artifact-1&run=run-1');
  });

  it('opens knowledge files while clearing workbench item selections', () => {
    expect(buildOpenKnowledgeFileSearch('?artifact=a&checkpoint=c&run=r&x=1', ' docs/readme.md ')).toBe('x=1&file=docs%2Freadme.md');
    expect(buildOpenKnowledgeFileSearch('?x=1', '   ')).toBeNull();
  });
});
