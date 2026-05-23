import { describe, expect, it } from 'vitest';

import { MAX_DESKTOP_ROLLBACK_TURNS, validateDesktopRollbackTurns } from './localApiRollback';

describe('localApiRollback', () => {
  it('accepts positive safe rollback turn counts within the cap', () => {
    expect(() => validateDesktopRollbackTurns(1)).not.toThrow();
    expect(() => validateDesktopRollbackTurns(MAX_DESKTOP_ROLLBACK_TURNS)).not.toThrow();
  });

  it('rejects invalid rollback turn counts', () => {
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, MAX_DESKTOP_ROLLBACK_TURNS + 1]) {
      expect(() => validateDesktopRollbackTurns(value)).toThrow('numTurns must be a positive integer.');
    }
  });
});
