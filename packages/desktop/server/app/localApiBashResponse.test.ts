import { describe, expect, it } from 'vitest';

import { buildExecuteLiveSessionBashResponse } from './localApiBashResponse';

describe('localApiBashResponse', () => {
  it('builds execute bash responses', () => {
    expect(buildExecuteLiveSessionBashResponse({ result: { exitCode: 0 } })).toEqual({ ok: true, result: { exitCode: 0 } });
  });
});
