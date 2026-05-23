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

  it('falls back when error stop reason has no message', () => {
    expect(getAssistantErrorDisplayMessage({ stopReason: 'error', errorMessage: '  ' })).toBe(
      'The model returned an error before completing its response.',
    );
  });
});
