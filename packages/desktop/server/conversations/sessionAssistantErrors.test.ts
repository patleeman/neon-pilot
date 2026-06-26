import { describe, expect, it } from 'vitest';

import { getAssistantErrorDisplayMessage } from './sessionAssistantErrors';

describe('sessionAssistantErrors', () => {
  it('returns no display message for non-error stop reasons', () => {
    expect(getAssistantErrorDisplayMessage({ stopReason: 'end_turn', errorMessage: 'boom' })).toBeNull();
    expect(getAssistantErrorDisplayMessage({})).toBeNull();
  });

  it('uses trimmed assistant error messages when present', () => {
    expect(getAssistantErrorDisplayMessage({ stopReason: 'error', errorMessage: '  boom  ' })).toBe('boom');
  });

  it('sanitizes provider setup guidance that includes local doc paths', () => {
    expect(
      getAssistantErrorDisplayMessage({
        stopReason: 'error',
        errorMessage: [
          'No API key found for the selected model.',
          '',
          'Use /login to log into a provider via OAuth or API key. See:',
          '  /Users/patrick/workingdir/neon-pilot/node_modules/provider/docs/providers.md',
        ].join('\n'),
      }),
    ).toBe('No API key found for the selected model. Configure a provider in Neon Pilot, then try again.');
  });

  it('sanitizes provider keychain command failures', () => {
    expect(
      getAssistantErrorDisplayMessage({
        stopReason: 'error',
        errorMessage:
          'Failed to resolve API key for provider "opencode-go" from shell command: security find-generic-password -a "provider:opencode-go:apiKey" -w',
      }),
    ).toBe('No API key is available for provider "opencode-go". Add one in Settings, then try again.');
  });

  it('falls back when error stop reason has no message', () => {
    expect(getAssistantErrorDisplayMessage({ stopReason: 'error', errorMessage: '  ' })).toBe(
      'The model returned an error before completing its response.',
    );
  });
});
