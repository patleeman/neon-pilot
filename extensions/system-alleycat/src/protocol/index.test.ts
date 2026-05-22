import { describe, expect, it } from 'vitest';

import { REGISTERED_HANDLERS } from './index.js';

describe('alleycat protocol registry', () => {
  it('registers core lifecycle, conversation, filesystem, shell, and compatibility handlers', () => {
    expect(REGISTERED_HANDLERS.initialize).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['thread/start']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['turn/start']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['workspace/update']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['fs/readFile']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['command/exec']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['model/list']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['skills/list']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['process/spawn']).toBeTypeOf('function');
    expect(REGISTERED_HANDLERS['tool/requestUserInput']).toBeTypeOf('function');
  });

  it('keeps fuzzy file search aliases wired to the same handler', () => {
    expect(REGISTERED_HANDLERS.fuzzyFileSearch).toBe(REGISTERED_HANDLERS['fs/fuzzyFileSearch']);
    expect(REGISTERED_HANDLERS['fs/search']).toBe(REGISTERED_HANDLERS['fs/fuzzyFileSearch']);
  });
});
