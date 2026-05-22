import { describe, expect, it } from 'vitest';

import * as daemon from './index.js';

describe('@neon-pilot/daemon barrel', () => {
  it('reexports daemon client, in-process transport, companion runtime, and background agent helpers', () => {
    expect(daemon).toEqual(
      expect.objectContaining({
        buildBackgroundAgentArgv: expect.any(Function),
        looksLikeBackgroundAgentRunnerEntryPath: expect.any(Function),
        pingDaemon: expect.any(Function),
        getDaemonStatus: expect.any(Function),
        startBackgroundRun: expect.any(Function),
        emitDaemonEventNonFatal: expect.any(Function),
        bindInProcessDaemonClient: expect.any(Function),
        createInProcessDaemonClient: expect.any(Function),
        getCompanionRuntimeProvider: expect.any(Function),
        setCompanionRuntimeProvider: expect.any(Function),
        resolveCompanionRuntime: expect.any(Function),
      }),
    );
  });

  it('reexports automation, task, run store, and database lifecycle helpers', () => {
    expect(daemon).toEqual(
      expect.objectContaining({
        createStoredAutomation: expect.any(Function),
        listStoredAutomations: expect.any(Function),
        parseTaskDefinition: expect.any(Function),
        createBackgroundRunId: expect.any(Function),
        createDurableRunManifest: expect.any(Function),
        createWebLiveConversationRunId: expect.any(Function),
        saveWebLiveConversationRunState: expect.any(Function),
        closeAllDbs: expect.any(Function),
        checkpointAllDbsPassive: expect.any(Function),
      }),
    );
  });
});
