import { describe, expect, it, vi } from 'vitest';

const core = vi.hoisted(() => ({ getDurableSessionsDir: vi.fn() }));

vi.mock('@neon-pilot/core', () => core);

import { resolveBackgroundRunSessionDir } from './background-run-sessions.js';

describe('background-run-sessions', () => {
  it('places background run sessions under the durable sessions __runs namespace', () => {
    core.getDurableSessionsDir.mockReturnValue('/state/sessions');

    expect(resolveBackgroundRunSessionDir('run-1')).toBe('/state/sessions/__runs/run-1');
    expect(core.getDurableSessionsDir).toHaveBeenCalledWith();
  });
});
