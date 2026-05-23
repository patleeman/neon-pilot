import { describe, expect, it } from 'vitest';

import {
  buildExtensionPromptContextProviderRegistrations,
  sortExtensionPromptContextProviderRegistrations,
} from './extensionPromptContextProviderRegistrations';

describe('extensionPromptContextProviderRegistrations', () => {
  it('builds prompt and turn context providers with trimmed ids and handlers', () => {
    expect(
      buildExtensionPromptContextProviderRegistrations({
        manifest: {
          id: 'ext',
          packageType: 'system',
          contributes: {
            promptContextProviders: [
              { id: ' prompt ', handler: ' handle.prompt ', title: 'Prompt', priority: 5, scope: ['global', 'bad', 'conversation'] },
            ],
            turnContextProviders: [{ id: 'turn', handler: 'handle.turn', priority: 1, scope: ['workspace'] }],
          },
        },
      }),
    ).toEqual([
      {
        extensionId: 'ext',
        id: 'prompt',
        packageType: 'system',
        handler: 'handle.prompt',
        title: 'Prompt',
        priority: 5,
        scope: ['global', 'conversation'],
      },
      {
        extensionId: 'ext',
        id: 'turn',
        packageType: 'system',
        handler: 'handle.turn',
        priority: 1,
        scope: ['workspace'],
      },
    ]);
  });

  it('drops providers missing ids or handlers and ignores non-integer priorities', () => {
    expect(
      buildExtensionPromptContextProviderRegistrations({
        manifest: {
          id: 'ext',
          contributes: {
            promptContextProviders: [
              { id: ' ', handler: 'handler' },
              { id: 'id', handler: ' ' },
              { id: 'ok', handler: 'handler', priority: 1.5 },
            ],
          },
        },
      }),
    ).toEqual([{ extensionId: 'ext', id: 'ok', packageType: 'user', handler: 'handler' }]);
  });

  it('sorts by ascending priority with missing priority as zero', () => {
    const providers = [{ id: 'late', priority: 10 }, { id: 'zero' }, { id: 'early', priority: -1 }];
    expect(sortExtensionPromptContextProviderRegistrations(providers)).toEqual([
      { id: 'early', priority: -1 },
      { id: 'zero' },
      { id: 'late', priority: 10 },
    ]);
  });
});
