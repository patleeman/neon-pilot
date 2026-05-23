import { describe, expect, it } from 'vitest';

import { shouldSwitchToWorkbenchForSelectedRun } from './conversationLayoutMode';

describe('conversationLayoutMode', () => {
  it('switches to workbench only for a new selected run outside workbench mode', () => {
    expect(shouldSwitchToWorkbenchForSelectedRun({ selectedRunId: null, previousSelectedRunId: null, appLayoutMode: 'compact' })).toBe(
      false,
    );
    expect(
      shouldSwitchToWorkbenchForSelectedRun({ selectedRunId: 'run-1', previousSelectedRunId: 'run-1', appLayoutMode: 'compact' }),
    ).toBe(false);
    expect(shouldSwitchToWorkbenchForSelectedRun({ selectedRunId: 'run-1', previousSelectedRunId: null, appLayoutMode: 'workbench' })).toBe(
      false,
    );
    expect(shouldSwitchToWorkbenchForSelectedRun({ selectedRunId: 'run-1', previousSelectedRunId: null, appLayoutMode: 'compact' })).toBe(
      true,
    );
  });
});
