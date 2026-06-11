import { describe, expect, it, vi } from 'vitest';

import { HOST_COMMAND_IDS } from '../../../server/extensions/hostCommands';
import { CORE_KEYBOARD_SHORTCUT_REGISTRATIONS } from '../../../src/keyboard-shortcuts';
import {
  canExecuteExtensionCommand,
  createHostCommands,
  evaluateCommandEnablement,
  executeExtensionCommand,
  listHostCommands,
  normalizeLegacyCommand,
} from './commands';

describe('extension commands', () => {
  it('keeps the renderer host command catalog aligned with the server allowlist', () => {
    expect(listHostCommands().map((command) => command.id).sort()).toEqual([...HOST_COMMAND_IDS].sort());
  });

  it('keeps every listed host command backed by a renderer executor', () => {
    const executorIds = new Set(
      createHostCommands({
        navigate: vi.fn(),
        openCommandPalette: vi.fn(),
        openRightRail: vi.fn(),
        setLayout: vi.fn(),
      }).map((command) => command.id),
    );

    expect(listHostCommands().map((command) => command.id).sort()).toEqual([...executorIds].sort());
  });

  it('keeps desktop shortcut commands backed by executable host commands', () => {
    const desktopNativeCommands = new Set(['core.showApp', 'core.quit']);
    const hostCommandIds = new Set(listHostCommands().map((command) => command.id));

    for (const registration of CORE_KEYBOARD_SHORTCUT_REGISTRATIONS) {
      if (desktopNativeCommands.has(registration.command)) continue;
      expect(hostCommandIds.has(normalizeLegacyCommand(registration.command).command), registration.id).toBe(true);
    }
  });

  it('normalizes legacy host command strings', () => {
    expect(normalizeLegacyCommand('navigate:/settings')).toEqual({ command: 'app.navigate', args: { to: '/settings' } });
    expect(normalizeLegacyCommand('commandPalette:threads')).toEqual({ command: 'palette.open', args: { scope: 'threads' } });
    expect(normalizeLegacyCommand('layout:workbench')).toEqual({ command: 'layout.set', args: { mode: 'workbench' } });
    expect(normalizeLegacyCommand('core.settings')).toEqual({ command: 'app.navigate', args: { to: '/settings' } });
    expect(normalizeLegacyCommand('core.toggleSidebar')).toEqual({ command: 'layout.toggleSidebar' });
    expect(normalizeLegacyCommand('core.findOnPage')).toEqual({ command: 'page.find' });
    expect(normalizeLegacyCommand('core.closeTab')).toEqual({ command: 'conversation.close' });
    expect(normalizeLegacyCommand('core.archiveRestoreConversation')).toEqual({ command: 'conversation.toggleArchived' });
    expect(normalizeLegacyCommand('core.renameConversation')).toEqual({ command: 'conversation.rename' });
    expect(normalizeLegacyCommand('rightRail:system-browser/browser-tabs')).toEqual({
      command: 'rail.open',
      args: { extensionId: 'system-browser', surfaceId: 'browser-tabs' },
    });
  });

  it('evaluates the intentionally tiny enablement language', () => {
    const context = { 'speechmic.connected': true, 'layout.mode': 'workbench', 'conversation.isStreaming': false };
    expect(evaluateCommandEnablement('speechmic.connected', context)).toBe(true);
    expect(evaluateCommandEnablement('!conversation.isStreaming', context)).toBe(true);
    expect(evaluateCommandEnablement('layout.mode == workbench', context)).toBe(true);
    expect(evaluateCommandEnablement('layout.mode != compact', context)).toBe(true);
    expect(evaluateCommandEnablement('missing.context', context)).toBe(false);
  });

  it('includes app history navigation commands gated by navigation availability', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['app.goBack', 'app.goForward']));
    const goBack = vi.fn(() => true);
    const goForward = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      goBack,
      goForward,
    };

    await expect(executeExtensionCommand('app.goBack', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('app.goBack', undefined, { ...options, context: { 'app.canGoBack': true } }),
    ).resolves.toBe(true);
    await expect(executeExtensionCommand('app.goForward', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('app.goForward', undefined, { ...options, context: { 'app.canGoForward': true } }),
    ).resolves.toBe(true);

    expect(goBack).toHaveBeenCalledTimes(1);
    expect(goForward).toHaveBeenCalledTimes(1);
  });

  it('gates argument-required host commands on usable arguments', async () => {
    const navigate = vi.fn();
    const openRightRail = vi.fn(() => true);
    const setLayout = vi.fn();
    const options = {
      navigate,
      openCommandPalette: vi.fn(),
      openRightRail,
      setLayout,
    };

    expect(canExecuteExtensionCommand('app.navigate', undefined, options)).toBe(false);
    expect(canExecuteExtensionCommand('app.navigate', { to: '/settings' }, options)).toBe(true);
    expect(canExecuteExtensionCommand('rail.open', undefined, options)).toBe(false);
    expect(canExecuteExtensionCommand('rail.open', { target: 'system-browser/browser-tabs' }, options)).toBe(true);
    expect(canExecuteExtensionCommand('rail.open', { extensionId: 'system-browser', surfaceId: 'browser-tabs' }, options)).toBe(true);
    expect(canExecuteExtensionCommand('layout.set', undefined, options)).toBe(false);
    expect(canExecuteExtensionCommand('layout.set', { mode: 'split' }, options)).toBe(false);
    expect(canExecuteExtensionCommand('layout.set', { mode: 'workbench' }, options)).toBe(true);

    await expect(executeExtensionCommand('app.navigate', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('rail.open', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('layout.set', { mode: 'split' }, options)).resolves.toBe(false);

    expect(navigate).not.toHaveBeenCalled();
    expect(openRightRail).not.toHaveBeenCalled();
    expect(setLayout).not.toHaveBeenCalled();
  });

  it('includes conversation cwd editor commands gated by editor state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'conversation.editCwd',
        'conversation.saveCwd',
        'conversation.cancelCwdEdit',
        'conversation.cancelGoal',
        'conversation.continueDeferredResumes',
        'conversation.toggleBackgroundRunDetails',
        'conversation.toggleDeferredResumeDetails',
        'conversation.toggleScheduledTaskDetails',
        'conversation.openLatestBackgroundRun',
        'conversation.cancelLatestBackgroundRun',
        'conversation.runFirstScheduledTask',
        'conversation.openFirstScheduledTask',
        'conversation.fireFirstDeferredResume',
        'conversation.cancelFirstDeferredResume',
        'conversation.restoreFirstQueuedPrompt',
      ]),
    );
    const editConversationCwd = vi.fn(() => true);
    const saveConversationCwd = vi.fn(() => true);
    const cancelConversationCwdEdit = vi.fn(() => true);
    const cancelConversationGoal = vi.fn(() => true);
    const continueDeferredResumes = vi.fn(() => true);
    const toggleBackgroundRunDetails = vi.fn(() => true);
    const toggleDeferredResumeDetails = vi.fn(() => true);
    const toggleScheduledTaskDetails = vi.fn(() => true);
    const openLatestBackgroundRun = vi.fn(() => true);
    const cancelLatestBackgroundRun = vi.fn(() => true);
    const runFirstScheduledTask = vi.fn(() => true);
    const openFirstScheduledTask = vi.fn(() => true);
    const fireFirstDeferredResume = vi.fn(() => true);
    const cancelFirstDeferredResume = vi.fn(() => true);
    const restoreFirstQueuedPrompt = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
      editConversationCwd,
      saveConversationCwd,
      cancelConversationCwdEdit,
      cancelConversationGoal,
      continueDeferredResumes,
      toggleBackgroundRunDetails,
      toggleDeferredResumeDetails,
      toggleScheduledTaskDetails,
      openLatestBackgroundRun,
      cancelLatestBackgroundRun,
      runFirstScheduledTask,
      openFirstScheduledTask,
      fireFirstDeferredResume,
      cancelFirstDeferredResume,
      restoreFirstQueuedPrompt,
    };

    await expect(executeExtensionCommand('conversation.editCwd', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.saveCwd', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.cancelCwdEdit', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.cancelGoal', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.continueDeferredResumes', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.toggleBackgroundRunDetails', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.toggleDeferredResumeDetails', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.toggleScheduledTaskDetails', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.openLatestBackgroundRun', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.cancelLatestBackgroundRun', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.runFirstScheduledTask', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.openFirstScheduledTask', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.fireFirstDeferredResume', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.cancelFirstDeferredResume', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.restoreFirstQueuedPrompt', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('conversation.editCwd', undefined, {
        ...options,
        context: { 'conversation.canEditCwd': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.saveCwd', undefined, {
        ...options,
        context: { 'conversation.cwdEditorOpen': true, 'conversation.cwdEditorBusy': false },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.cancelCwdEdit', undefined, {
        ...options,
        context: { 'conversation.cwdEditorOpen': true, 'conversation.cwdEditorBusy': false },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.cancelGoal', undefined, {
        ...options,
        context: { 'conversation.goalActive': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.continueDeferredResumes', undefined, {
        ...options,
        context: { 'conversation.canContinueDeferredResumes': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.toggleBackgroundRunDetails', undefined, {
        ...options,
        context: { 'conversation.hasBackgroundRuns': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.toggleDeferredResumeDetails', undefined, {
        ...options,
        context: { 'conversation.hasDeferredResumes': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.toggleScheduledTaskDetails', undefined, {
        ...options,
        context: { 'conversation.hasScheduledTasks': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.openLatestBackgroundRun', undefined, {
        ...options,
        context: { 'conversation.canOpenLatestBackgroundRun': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.cancelLatestBackgroundRun', undefined, {
        ...options,
        context: { 'conversation.canCancelLatestBackgroundRun': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.runFirstScheduledTask', undefined, {
        ...options,
        context: { 'conversation.canRunFirstScheduledTask': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.openFirstScheduledTask', undefined, {
        ...options,
        context: { 'conversation.canOpenFirstScheduledTask': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.fireFirstDeferredResume', undefined, {
        ...options,
        context: { 'conversation.canFireFirstDeferredResume': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.cancelFirstDeferredResume', undefined, {
        ...options,
        context: { 'conversation.canCancelFirstDeferredResume': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.restoreFirstQueuedPrompt', undefined, {
        ...options,
        context: { 'conversation.canRestoreFirstQueuedPrompt': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.saveCwd', undefined, {
        ...options,
        context: { 'conversation.cwdEditorOpen': true, 'conversation.cwdEditorBusy': true },
      }),
    ).resolves.toBe(false);

    expect(editConversationCwd).toHaveBeenCalledTimes(1);
    expect(saveConversationCwd).toHaveBeenCalledTimes(1);
    expect(cancelConversationCwdEdit).toHaveBeenCalledTimes(1);
    expect(cancelConversationGoal).toHaveBeenCalledTimes(1);
    expect(continueDeferredResumes).toHaveBeenCalledTimes(1);
    expect(toggleBackgroundRunDetails).toHaveBeenCalledTimes(1);
    expect(toggleDeferredResumeDetails).toHaveBeenCalledTimes(1);
    expect(toggleScheduledTaskDetails).toHaveBeenCalledTimes(1);
    expect(openLatestBackgroundRun).toHaveBeenCalledTimes(1);
    expect(cancelLatestBackgroundRun).toHaveBeenCalledTimes(1);
    expect(runFirstScheduledTask).toHaveBeenCalledTimes(1);
    expect(openFirstScheduledTask).toHaveBeenCalledTimes(1);
    expect(fireFirstDeferredResume).toHaveBeenCalledTimes(1);
    expect(cancelFirstDeferredResume).toHaveBeenCalledTimes(1);
    expect(restoreFirstQueuedPrompt).toHaveBeenCalledTimes(1);
  });

  it('includes checkpoint rail commands gated by checkpoint availability', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'conversation.openActiveCheckpoint',
        'conversation.openLatestCheckpoint',
        'conversation.scrollFirstCheckpointFile',
      ]),
    );

    const openActiveCheckpoint = vi.fn(() => true);
    const openLatestCheckpoint = vi.fn(() => true);
    const scrollFirstCheckpointFile = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
      openActiveCheckpoint,
      openLatestCheckpoint,
      scrollFirstCheckpointFile,
    };

    await expect(executeExtensionCommand('conversation.openActiveCheckpoint', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.openLatestCheckpoint', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.scrollFirstCheckpointFile', undefined, options)).resolves.toBe(false);

    await expect(
      executeExtensionCommand('conversation.openActiveCheckpoint', undefined, {
        ...options,
        context: { 'conversation.canOpenActiveCheckpoint': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.openLatestCheckpoint', undefined, {
        ...options,
        context: { 'conversation.canOpenLatestCheckpoint': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.scrollFirstCheckpointFile', undefined, {
        ...options,
        context: { 'conversation.canScrollFirstCheckpointFile': true },
      }),
    ).resolves.toBe(true);

    expect(openActiveCheckpoint).toHaveBeenCalledTimes(1);
    expect(openLatestCheckpoint).toHaveBeenCalledTimes(1);
    expect(scrollFirstCheckpointFile).toHaveBeenCalledTimes(1);
  });

  it('includes drawing picker commands gated by picker state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['drawingPicker.close', 'drawingPicker.attachFirst', 'drawingPicker.toggleFirstHistory']),
    );

    const closeDrawingPicker = vi.fn(() => true);
    const attachFirstDrawingFromPicker = vi.fn(() => true);
    const toggleFirstDrawingHistory = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      closeDrawingPicker,
      attachFirstDrawingFromPicker,
      toggleFirstDrawingHistory,
    };

    await expect(executeExtensionCommand('drawingPicker.close', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('drawingPicker.attachFirst', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('drawingPicker.toggleFirstHistory', undefined, options)).resolves.toBe(false);

    await expect(
      executeExtensionCommand('drawingPicker.close', undefined, {
        ...options,
        context: { 'drawingPicker.open': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('drawingPicker.attachFirst', undefined, {
        ...options,
        context: { 'drawingPicker.hasVisibleDrawing': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('drawingPicker.toggleFirstHistory', undefined, {
        ...options,
        context: { 'drawingPicker.hasVisibleDrawing': true },
      }),
    ).resolves.toBe(true);

    expect(closeDrawingPicker).toHaveBeenCalledTimes(1);
    expect(attachFirstDrawingFromPicker).toHaveBeenCalledTimes(1);
    expect(toggleFirstDrawingHistory).toHaveBeenCalledTimes(1);
  });

  it('includes message action commands gated by available transcript actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'messageAction.copyFirst',
        'messageAction.editFirst',
        'messageAction.rewindFirst',
        'messageAction.forkFirst',
      ]),
    );

    const copyFirstMessageAction = vi.fn(() => true);
    const editFirstMessageAction = vi.fn(() => true);
    const rewindFirstMessageAction = vi.fn(() => true);
    const forkFirstMessageAction = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      copyFirstMessageAction,
      editFirstMessageAction,
      rewindFirstMessageAction,
      forkFirstMessageAction,
    };

    await expect(executeExtensionCommand('messageAction.copyFirst', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('messageAction.editFirst', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('messageAction.rewindFirst', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('messageAction.forkFirst', undefined, options)).resolves.toBe(false);

    await expect(
      executeExtensionCommand('messageAction.copyFirst', undefined, {
        ...options,
        context: { 'messageAction.canCopyFirst': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('messageAction.editFirst', undefined, {
        ...options,
        context: { 'messageAction.canEditFirst': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('messageAction.rewindFirst', undefined, {
        ...options,
        context: { 'messageAction.canRewindFirst': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('messageAction.forkFirst', undefined, {
        ...options,
        context: { 'messageAction.canForkFirst': true },
      }),
    ).resolves.toBe(true);

    expect(copyFirstMessageAction).toHaveBeenCalledTimes(1);
    expect(editFirstMessageAction).toHaveBeenCalledTimes(1);
    expect(rewindFirstMessageAction).toHaveBeenCalledTimes(1);
    expect(forkFirstMessageAction).toHaveBeenCalledTimes(1);
  });

  it('includes image preview commands gated by available image actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['imagePreview.inspectFirst', 'imagePreview.loadFirst']),
    );

    const inspectFirstImagePreview = vi.fn(() => true);
    const loadFirstImagePreview = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      inspectFirstImagePreview,
      loadFirstImagePreview,
    };

    await expect(executeExtensionCommand('imagePreview.inspectFirst', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('imagePreview.loadFirst', undefined, options)).resolves.toBe(false);

    await expect(
      executeExtensionCommand('imagePreview.inspectFirst', undefined, {
        ...options,
        context: { 'imagePreview.canInspectFirst': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('imagePreview.loadFirst', undefined, {
        ...options,
        context: { 'imagePreview.canLoadFirst': true },
      }),
    ).resolves.toBe(true);

    expect(inspectFirstImagePreview).toHaveBeenCalledTimes(1);
    expect(loadFirstImagePreview).toHaveBeenCalledTimes(1);
  });

  it('includes file change commands gated by available diff state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['fileChange.toggleFirst']));

    const toggleFirstFileChange = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleFirstFileChange,
    };

    await expect(executeExtensionCommand('fileChange.toggleFirst', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('fileChange.toggleFirst', undefined, {
        ...options,
        context: { 'fileChange.canToggleFirst': true },
      }),
    ).resolves.toBe(true);

    expect(toggleFirstFileChange).toHaveBeenCalledTimes(1);
  });

  it('includes tool block commands gated by transcript tool state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['toolBlock.toggleFirst', 'toolBlock.toggleFirstLinkedRuns']),
    );

    const toggleFirstToolBlock = vi.fn(() => true);
    const toggleFirstToolBlockLinkedRuns = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleFirstToolBlock,
      toggleFirstToolBlockLinkedRuns,
    };

    await expect(executeExtensionCommand('toolBlock.toggleFirst', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('toolBlock.toggleFirst', undefined, {
        ...options,
        context: { 'toolBlock.canToggleFirst': true },
      }),
    ).resolves.toBe(true);

    await expect(executeExtensionCommand('toolBlock.toggleFirstLinkedRuns', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('toolBlock.toggleFirstLinkedRuns', undefined, {
        ...options,
        context: { 'toolBlock.canToggleFirstLinkedRuns': true },
      }),
    ).resolves.toBe(true);

    expect(toggleFirstToolBlock).toHaveBeenCalledTimes(1);
    expect(toggleFirstToolBlockLinkedRuns).toHaveBeenCalledTimes(1);
  });

  it('includes trace cluster commands gated by transcript trace state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['traceCluster.toggleFirst', 'traceCluster.toggleFirstOverflow', 'inlineTraceRun.toggleFirst']),
    );

    const toggleFirstTraceCluster = vi.fn(() => true);
    const toggleFirstTraceClusterOverflow = vi.fn(() => true);
    const toggleFirstInlineTraceRun = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleFirstTraceCluster,
      toggleFirstTraceClusterOverflow,
      toggleFirstInlineTraceRun,
    };

    await expect(executeExtensionCommand('traceCluster.toggleFirst', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('traceCluster.toggleFirst', undefined, {
        ...options,
        context: { 'traceCluster.canToggleFirst': true },
      }),
    ).resolves.toBe(true);

    await expect(executeExtensionCommand('traceCluster.toggleFirstOverflow', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('traceCluster.toggleFirstOverflow', undefined, {
        ...options,
        context: { 'traceCluster.canToggleFirstOverflow': true },
      }),
    ).resolves.toBe(true);

    await expect(executeExtensionCommand('inlineTraceRun.toggleFirst', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('inlineTraceRun.toggleFirst', undefined, {
        ...options,
        context: { 'inlineTraceRun.canToggleFirst': true },
      }),
    ).resolves.toBe(true);

    expect(toggleFirstTraceCluster).toHaveBeenCalledTimes(1);
    expect(toggleFirstTraceClusterOverflow).toHaveBeenCalledTimes(1);
    expect(toggleFirstInlineTraceRun).toHaveBeenCalledTimes(1);
  });

  it('includes thinking block commands gated by transcript thinking state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['thinkingBlock.toggleFirst']));

    const toggleFirstThinkingBlock = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleFirstThinkingBlock,
    };

    await expect(executeExtensionCommand('thinkingBlock.toggleFirst', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('thinkingBlock.toggleFirst', undefined, {
        ...options,
        context: { 'thinkingBlock.canToggleFirst': true },
      }),
    ).resolves.toBe(true);

    expect(toggleFirstThinkingBlock).toHaveBeenCalledTimes(1);
  });

  it('includes subagent block commands gated by transcript subagent state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['subagentBlock.toggleFirst']));

    const toggleFirstSubagentBlock = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleFirstSubagentBlock,
    };

    await expect(executeExtensionCommand('subagentBlock.toggleFirst', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('subagentBlock.toggleFirst', undefined, {
        ...options,
        context: { 'subagentBlock.canToggleFirst': true },
      }),
    ).resolves.toBe(true);

    expect(toggleFirstSubagentBlock).toHaveBeenCalledTimes(1);
  });

  it('includes conversation title editor commands gated by editor state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['conversation.rename', 'conversation.saveTitle', 'conversation.cancelTitleEdit']),
    );
    const renameConversation = vi.fn(() => true);
    const saveConversationTitle = vi.fn(() => true);
    const cancelConversationTitleEdit = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
      renameConversation,
      saveConversationTitle,
      cancelConversationTitleEdit,
    };

    await expect(
      executeExtensionCommand('conversation.rename', undefined, {
        ...options,
        context: { 'conversation.canRename': true },
      }),
    ).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.saveTitle', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.cancelTitleEdit', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('conversation.saveTitle', undefined, {
        ...options,
        context: { 'conversation.titleEditorOpen': true, 'conversation.titleEditorBusy': false },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.cancelTitleEdit', undefined, {
        ...options,
        context: { 'conversation.titleEditorOpen': true, 'conversation.titleEditorBusy': false },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.saveTitle', undefined, {
        ...options,
        context: { 'conversation.titleEditorOpen': true, 'conversation.titleEditorBusy': true },
      }),
    ).resolves.toBe(false);

    expect(renameConversation).toHaveBeenCalledTimes(1);
    expect(saveConversationTitle).toHaveBeenCalledTimes(1);
    expect(cancelConversationTitleEdit).toHaveBeenCalledTimes(1);
  });

  it('includes notification commands gated by notification state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['notifications.open', 'notifications.close', 'notifications.markAllRead', 'notifications.dismissAll']),
    );
    const openNotifications = vi.fn(() => true);
    const closeNotifications = vi.fn(() => true);
    const markAllNotificationsRead = vi.fn(() => true);
    const dismissAllNotifications = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      openNotifications,
      closeNotifications,
      markAllNotificationsRead,
      dismissAllNotifications,
    };

    await expect(executeExtensionCommand('notifications.open', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('notifications.close', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('notifications.markAllRead', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('notifications.dismissAll', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('notifications.close', undefined, { ...options, context: { 'notifications.open': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('notifications.markAllRead', undefined, { ...options, context: { 'notifications.hasUnread': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('notifications.dismissAll', undefined, { ...options, context: { 'notifications.hasVisible': true } }),
    ).resolves.toBe(true);

    expect(openNotifications).toHaveBeenCalledTimes(1);
    expect(closeNotifications).toHaveBeenCalledTimes(1);
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(dismissAllNotifications).toHaveBeenCalledTimes(1);
  });

  it('includes browser toolbar commands gated by browser state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'browser.newTab',
        'browser.reopenTab',
        'browser.closeTab',
        'browser.goBack',
        'browser.goForward',
        'browser.reloadOrStop',
        'browser.focusLocation',
        'browser.close',
      ]),
    );
    const browserNewTab = vi.fn(() => true);
    const browserReopenTab = vi.fn(() => true);
    const browserCloseTab = vi.fn(() => true);
    const browserGoBack = vi.fn(() => true);
    const browserGoForward = vi.fn(() => true);
    const browserReloadOrStop = vi.fn(() => true);
    const browserFocusLocation = vi.fn(() => true);
    const browserClose = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      browserNewTab,
      browserReopenTab,
      browserCloseTab,
      browserGoBack,
      browserGoForward,
      browserReloadOrStop,
      browserFocusLocation,
      browserClose,
    };

    await expect(executeExtensionCommand('browser.goBack', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('browser.newTab', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('browser.reopenTab', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('browser.closeTab', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('browser.goForward', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('browser.reloadOrStop', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('browser.focusLocation', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('browser.close', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('browser.goBack', undefined, { ...options, context: { 'browser.canGoBack': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('browser.newTab', undefined, { ...options, context: { 'browser.active': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('browser.reopenTab', undefined, { ...options, context: { 'browser.active': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('browser.closeTab', undefined, { ...options, context: { 'browser.active': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('browser.goForward', undefined, { ...options, context: { 'browser.canGoForward': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('browser.reloadOrStop', undefined, { ...options, context: { 'browser.active': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('browser.focusLocation', undefined, { ...options, context: { 'browser.active': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('browser.close', undefined, { ...options, context: { 'browser.active': true } }),
    ).resolves.toBe(true);

    expect(browserGoBack).toHaveBeenCalledTimes(1);
    expect(browserNewTab).toHaveBeenCalledTimes(1);
    expect(browserReopenTab).toHaveBeenCalledTimes(1);
    expect(browserCloseTab).toHaveBeenCalledTimes(1);
    expect(browserGoForward).toHaveBeenCalledTimes(1);
    expect(browserReloadOrStop).toHaveBeenCalledTimes(1);
    expect(browserFocusLocation).toHaveBeenCalledTimes(1);
    expect(browserClose).toHaveBeenCalledTimes(1);
  });

  it('includes artifact modal commands gated by modal state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['artifact.copySource', 'artifact.toggleSource', 'artifact.toggleFullscreen', 'artifact.close']),
    );
    const artifactCopySource = vi.fn(() => true);
    const artifactToggleSource = vi.fn(() => true);
    const artifactToggleFullscreen = vi.fn(() => true);
    const artifactClose = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      artifactCopySource,
      artifactToggleSource,
      artifactToggleFullscreen,
      artifactClose,
    };

    await expect(executeExtensionCommand('artifact.copySource', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('artifact.toggleSource', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('artifact.toggleFullscreen', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('artifact.close', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('artifact.copySource', undefined, { ...options, context: { 'artifact.active': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('artifact.toggleSource', undefined, { ...options, context: { 'artifact.canShowSource': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('artifact.toggleFullscreen', undefined, { ...options, context: { 'artifact.active': true } }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('artifact.close', undefined, { ...options, context: { 'artifact.active': true } }),
    ).resolves.toBe(true);

    expect(artifactCopySource).toHaveBeenCalledTimes(1);
    expect(artifactToggleSource).toHaveBeenCalledTimes(1);
    expect(artifactToggleFullscreen).toHaveBeenCalledTimes(1);
    expect(artifactClose).toHaveBeenCalledTimes(1);
  });

  it('includes image preview commands gated by preview state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['imagePreview.close']));
    const closeImagePreview = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      closeImagePreview,
    };

    await expect(executeExtensionCommand('imagePreview.close', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('imagePreview.close', undefined, { ...options, context: { 'imagePreview.active': true } }),
    ).resolves.toBe(true);

    expect(closeImagePreview).toHaveBeenCalledTimes(1);
  });

  it('includes message edit commands gated by edit state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['messageEdit.save', 'messageEdit.cancel']));
    const saveMessageEdit = vi.fn(() => true);
    const cancelMessageEdit = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      saveMessageEdit,
      cancelMessageEdit,
    };

    await expect(executeExtensionCommand('messageEdit.save', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('messageEdit.cancel', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('messageEdit.save', undefined, {
        ...options,
        context: { 'messageEdit.active': true, 'messageEdit.canSave': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('messageEdit.cancel', undefined, {
        ...options,
        context: { 'messageEdit.active': true, 'messageEdit.canSave': false },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('messageEdit.save', undefined, {
        ...options,
        context: { 'messageEdit.active': true, 'messageEdit.canSave': false },
      }),
    ).resolves.toBe(false);

    expect(saveMessageEdit).toHaveBeenCalledTimes(1);
    expect(cancelMessageEdit).toHaveBeenCalledTimes(1);
  });

  it('includes draft workspace picker commands gated by picker state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['draftWorkspacePicker.open', 'draftWorkspacePicker.toggle', 'draftWorkspacePicker.close']),
    );
    const openDraftWorkspacePicker = vi.fn(() => true);
    const toggleDraftWorkspacePicker = vi.fn(() => true);
    const closeDraftWorkspacePicker = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      openDraftWorkspacePicker,
      toggleDraftWorkspacePicker,
      closeDraftWorkspacePicker,
    };

    await expect(executeExtensionCommand('draftWorkspacePicker.open', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('draftWorkspacePicker.toggle', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('draftWorkspacePicker.close', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('draftWorkspacePicker.open', undefined, {
        ...options,
        context: { 'draftWorkspacePicker.available': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('draftWorkspacePicker.toggle', undefined, {
        ...options,
        context: { 'draftWorkspacePicker.available': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('draftWorkspacePicker.close', undefined, {
        ...options,
        context: { 'draftWorkspacePicker.open': true },
      }),
    ).resolves.toBe(true);

    expect(openDraftWorkspacePicker).toHaveBeenCalledTimes(1);
    expect(toggleDraftWorkspacePicker).toHaveBeenCalledTimes(1);
    expect(closeDraftWorkspacePicker).toHaveBeenCalledTimes(1);
  });

  it('includes workspace quick select commands gated by picker state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['workspaceQuickSelect.close']));
    const closeWorkspaceQuickSelect = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      closeWorkspaceQuickSelect,
    };

    await expect(executeExtensionCommand('workspaceQuickSelect.close', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('workspaceQuickSelect.close', undefined, {
        ...options,
        context: { 'workspaceQuickSelect.open': true },
      }),
    ).resolves.toBe(true);

    expect(closeWorkspaceQuickSelect).toHaveBeenCalledTimes(1);
  });

  it('includes extension modal commands gated by modal state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(expect.arrayContaining(['extensionModal.close']));
    const closeExtensionModal = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      closeExtensionModal,
    };

    await expect(executeExtensionCommand('extensionModal.close', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('extensionModal.close', undefined, {
        ...options,
        context: { 'extensionModal.open': true },
      }),
    ).resolves.toBe(true);

    expect(closeExtensionModal).toHaveBeenCalledTimes(1);
  });

  it('includes hardware-friendly composer and dictation commands', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining(['composer.submit', 'composer.stop', 'dictation.toggle']),
    );

    const submitComposer = vi.fn(() => true);
    const stopComposer = vi.fn(() => true);
    const toggleDictation = vi.fn(() => true);
    const commands = createHostCommands({
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      submitComposer,
      stopComposer,
      toggleDictation,
      context: { 'conversation.isStreaming': true, 'system-local-dictation.toggleAvailable': true },
    });

    await expect(Promise.resolve(commands.find((command) => command.id === 'composer.submit')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'composer.stop')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'dictation.toggle')?.execute(undefined))).resolves.toBe(true);
    expect(submitComposer).toHaveBeenCalledTimes(1);
    expect(stopComposer).toHaveBeenCalledTimes(1);
    expect(toggleDictation).toHaveBeenCalledTimes(1);
  });

  it('disables dictation toggle unless the dictation extension publishes availability', async () => {
    const toggleDictation = vi.fn(() => true);
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleDictation,
    };

    await expect(executeExtensionCommand('dictation.toggle', undefined, baseOptions)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('dictation.toggle', undefined, {
        ...baseOptions,
        context: { 'system-local-dictation.toggleAvailable': true },
      }),
    ).resolves.toBe(true);

    expect(toggleDictation).toHaveBeenCalledTimes(1);
  });

  it('disables composer stop unless a conversation is streaming', async () => {
    const stopComposer = vi.fn(() => true);
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      stopComposer,
    };

    await expect(executeExtensionCommand('composer.stop', undefined, baseOptions)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('composer.stop', undefined, { ...baseOptions, context: { 'conversation.isStreaming': true } }),
    ).resolves.toBe(true);

    expect(stopComposer).toHaveBeenCalledTimes(1);
  });

  it('disables composer submit unless the composer publishes submit availability', async () => {
    const submitComposer = vi.fn(() => true);
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      submitComposer,
    };

    await expect(executeExtensionCommand('composer.submit', undefined, baseOptions)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('composer.submit', undefined, { ...baseOptions, context: { 'composer.canSubmit': true } }),
    ).resolves.toBe(true);

    expect(submitComposer).toHaveBeenCalledTimes(1);
  });

  it('disables composer clear unless the composer publishes clear availability', async () => {
    const clearComposer = vi.fn(() => true);
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      clearComposer,
    };

    await expect(executeExtensionCommand('composer.clear', undefined, baseOptions)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('composer.clear', undefined, { ...baseOptions, context: { 'composer.canClear': true } }),
    ).resolves.toBe(true);

    expect(clearComposer).toHaveBeenCalledTimes(1);
  });

  it('opens and closes composer settings and preferences based on composer menu state', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'composer.openSettings',
        'composer.closeSettings',
        'composer.openPreferences',
        'composer.togglePreferences',
        'composer.closePreferences',
        'composer.previewFirstAttachment',
        'composer.removeFirstAttachment',
        'composer.previewFirstDrawing',
        'composer.editFirstDrawing',
        'composer.removeFirstDrawing',
      ]),
    );
    const openComposerSettings = vi.fn(() => true);
    const closeComposerSettings = vi.fn(() => true);
    const openComposerPreferences = vi.fn(() => true);
    const toggleComposerPreferences = vi.fn(() => true);
    const closeComposerPreferences = vi.fn(() => true);
    const previewFirstComposerAttachment = vi.fn(() => true);
    const removeFirstComposerAttachment = vi.fn(() => true);
    const previewFirstComposerDrawing = vi.fn(() => true);
    const editFirstComposerDrawing = vi.fn(() => true);
    const removeFirstComposerDrawing = vi.fn(() => true);
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      openComposerSettings,
      closeComposerSettings,
      openComposerPreferences,
      toggleComposerPreferences,
      closeComposerPreferences,
      previewFirstComposerAttachment,
      removeFirstComposerAttachment,
      previewFirstComposerDrawing,
      editFirstComposerDrawing,
      removeFirstComposerDrawing,
    };

    await expect(executeExtensionCommand('composer.openSettings', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.closeSettings', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.openPreferences', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.togglePreferences', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.closePreferences', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.previewFirstAttachment', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.removeFirstAttachment', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.previewFirstDrawing', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.editFirstDrawing', undefined, baseOptions)).resolves.toBe(false);
    await expect(executeExtensionCommand('composer.removeFirstDrawing', undefined, baseOptions)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('composer.openSettings', undefined, {
        ...baseOptions,
        context: { 'composer.settingsAvailable': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.closeSettings', undefined, {
        ...baseOptions,
        context: { 'composer.settingsOpen': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.openPreferences', undefined, {
        ...baseOptions,
        context: { 'composer.preferencesAvailable': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.togglePreferences', undefined, {
        ...baseOptions,
        context: { 'composer.preferencesAvailable': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.closePreferences', undefined, {
        ...baseOptions,
        context: { 'composer.preferencesOpen': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.previewFirstAttachment', undefined, {
        ...baseOptions,
        context: { 'composer.canPreviewFirstAttachment': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.removeFirstAttachment', undefined, {
        ...baseOptions,
        context: { 'composer.canRemoveFirstAttachment': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.previewFirstDrawing', undefined, {
        ...baseOptions,
        context: { 'composer.canPreviewFirstDrawing': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.editFirstDrawing', undefined, {
        ...baseOptions,
        context: { 'composer.canEditFirstDrawing': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('composer.removeFirstDrawing', undefined, {
        ...baseOptions,
        context: { 'composer.canRemoveFirstDrawing': true },
      }),
    ).resolves.toBe(true);

    expect(openComposerSettings).toHaveBeenCalledTimes(1);
    expect(closeComposerSettings).toHaveBeenCalledTimes(1);
    expect(openComposerPreferences).toHaveBeenCalledTimes(1);
    expect(toggleComposerPreferences).toHaveBeenCalledTimes(1);
    expect(closeComposerPreferences).toHaveBeenCalledTimes(1);
    expect(previewFirstComposerAttachment).toHaveBeenCalledTimes(1);
    expect(removeFirstComposerAttachment).toHaveBeenCalledTimes(1);
    expect(previewFirstComposerDrawing).toHaveBeenCalledTimes(1);
    expect(editFirstComposerDrawing).toHaveBeenCalledTimes(1);
    expect(removeFirstComposerDrawing).toHaveBeenCalledTimes(1);
  });

  it('includes command-backed app chrome actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'layout.toggle',
        'layout.toggleSidebar',
        'layout.toggleRightRail',
        'page.find',
        'page.findNext',
        'page.findPrevious',
        'page.closeFind',
      ]),
    );

    const toggleLayout = vi.fn(() => true);
    const toggleSidebar = vi.fn(() => true);
    const toggleRightRail = vi.fn(() => true);
    const findOnPage = vi.fn(() => true);
    const findNextOnPage = vi.fn(() => true);
    const findPreviousOnPage = vi.fn(() => true);
    const closePageSearch = vi.fn(() => true);
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
    };

    const commands = createHostCommands({
      ...baseOptions,
      toggleLayout,
      toggleSidebar,
      toggleRightRail,
      findOnPage,
      findNextOnPage,
      findPreviousOnPage,
      closePageSearch,
    });

    await expect(Promise.resolve(commands.find((command) => command.id === 'layout.toggle')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'layout.toggleSidebar')?.execute(undefined))).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'layout.toggleRightRail')?.execute(undefined))).resolves.toBe(
      true,
    );
    await expect(executeExtensionCommand('layout.toggleRightRail', undefined, { ...baseOptions, toggleRightRail })).resolves.toBe(
      false,
    );
    await expect(
      executeExtensionCommand('layout.toggleRightRail', undefined, {
        ...baseOptions,
        toggleRightRail,
        context: { 'layout.canToggleRightRail': true },
      }),
    ).resolves.toBe(true);
    await expect(Promise.resolve(commands.find((command) => command.id === 'page.find')?.execute(undefined))).resolves.toBe(true);
    await expect(executeExtensionCommand('page.findNext', undefined, { ...baseOptions, findNextOnPage })).resolves.toBe(false);
    await expect(
      executeExtensionCommand('page.findNext', undefined, {
        ...baseOptions,
        findNextOnPage,
        context: { 'pageSearch.hasMatches': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('page.findPrevious', undefined, {
        ...baseOptions,
        findPreviousOnPage,
        context: { 'pageSearch.hasMatches': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('page.closeFind', undefined, {
        ...baseOptions,
        closePageSearch,
        context: { 'pageSearch.open': true },
      }),
    ).resolves.toBe(true);

    expect(toggleLayout).toHaveBeenCalledTimes(1);
    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(toggleRightRail).toHaveBeenCalledTimes(2);
    expect(findOnPage).toHaveBeenCalledTimes(1);
    expect(findNextOnPage).toHaveBeenCalledTimes(1);
    expect(findPreviousOnPage).toHaveBeenCalledTimes(1);
    expect(closePageSearch).toHaveBeenCalledTimes(1);
  });

  it('does not report unwired focus commands as handled', async () => {
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
    };

    await expect(executeExtensionCommand('composer.focus', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('sidebar.focus', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('focus.next', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('focus.previous', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('selection.activate', undefined, options)).resolves.toBe(false);
  });

  it('reports focus commands as unhandled when focus handlers cannot perform the action', async () => {
    const focusComposer = vi.fn(() => false);
    const focusSidebar = vi.fn(() => false);
    const focusNext = vi.fn(() => false);
    const focusPrevious = vi.fn(() => false);
    const activateSelection = vi.fn(() => false);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      focusComposer,
      focusSidebar,
      focusNext,
      focusPrevious,
      activateSelection,
    };

    await expect(executeExtensionCommand('composer.focus', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('sidebar.focus', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('focus.next', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('focus.previous', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('selection.activate', undefined, options)).resolves.toBe(false);

    expect(focusComposer).toHaveBeenCalledTimes(1);
    expect(focusSidebar).toHaveBeenCalledTimes(1);
    expect(focusNext).toHaveBeenCalledTimes(1);
    expect(focusPrevious).toHaveBeenCalledTimes(1);
    expect(activateSelection).toHaveBeenCalledTimes(1);
  });

  it('reports focus commands as handled when focus handlers perform the action', async () => {
    const focusComposer = vi.fn(() => true);
    const focusSidebar = vi.fn(() => true);
    const focusNext = vi.fn(() => true);
    const focusPrevious = vi.fn(() => true);
    const activateSelection = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      focusComposer,
      focusSidebar,
      focusNext,
      focusPrevious,
      activateSelection,
    };

    await expect(executeExtensionCommand('composer.focus', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('sidebar.focus', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('focus.next', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('focus.previous', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('selection.activate', undefined, options)).resolves.toBe(true);

    expect(focusComposer).toHaveBeenCalledTimes(1);
    expect(focusSidebar).toHaveBeenCalledTimes(1);
    expect(focusNext).toHaveBeenCalledTimes(1);
    expect(focusPrevious).toHaveBeenCalledTimes(1);
    expect(activateSelection).toHaveBeenCalledTimes(1);
  });

  it('reports optional host commands as disabled when their handlers are missing', () => {
    const commands = createHostCommands({
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
    });
    const commandById = new Map(commands.map((command) => [command.id, command]));

    for (const commandId of [
      'layout.toggle',
      'layout.toggleSidebar',
      'layout.toggleRightRail',
      'page.find',
      'conversation.next',
      'conversation.previous',
      'conversation.close',
      'conversation.reopenClosed',
      'conversation.togglePinned',
      'conversation.toggleArchived',
      'conversation.rename',
      'conversation.saveTitle',
      'conversation.cancelTitleEdit',
      'conversation.editCwd',
      'composer.focus',
      'composer.submit',
      'composer.clear',
      'conversation.pageUp',
      'conversation.pageDown',
      'workbench.newTab',
      'workbench.closeActiveTab',
      'workbench.closeActiveFile',
      'workbench.refreshActiveFile',
      'workbench.toggleExplorer',
      'workbench.toggleDiff',
      'conversation.newAndFocus',
      'model.cycle',
      'thinking.cycle',
      'dictation.toggle',
      'sidebar.focus',
      'focus.next',
      'focus.previous',
      'selection.activate',
    ]) {
      const command = commandById.get(commandId);
      expect(command?.canExecute?.(undefined, {}), commandId).toBe(false);
    }
  });

  it('checks command availability before global keybindings suppress input', () => {
    const extensionCommands = [
      {
        extensionId: 'system-test',
        surfaceId: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        action: 'layout.toggleSidebar',
      },
      {
        extensionId: 'system-test',
        surfaceId: 'run-action',
        title: 'Run Action',
        action: 'runAction',
        enablement: 'workspace.open',
      },
    ];
    const baseOptions = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      extensionCommands,
      context: { 'workspace.open': true },
    };

    expect(canExecuteExtensionCommand('layout.toggleSidebar', undefined, baseOptions)).toBe(false);
    expect(canExecuteExtensionCommand('system-test.toggle-sidebar', undefined, baseOptions)).toBe(false);
    expect(canExecuteExtensionCommand('system-test.run-action', undefined, baseOptions)).toBe(false);

    expect(
      canExecuteExtensionCommand('system-test.toggle-sidebar', undefined, {
        ...baseOptions,
        toggleSidebar: vi.fn(() => true),
      }),
    ).toBe(true);
    expect(
      canExecuteExtensionCommand('system-test.run-action', undefined, {
        ...baseOptions,
        invokeExtensionCommand: vi.fn(),
      }),
    ).toBe(true);
  });

  it('does not report extension commands as handled without an invoker', async () => {
    const extensionCommands = [
      {
        extensionId: 'system-test',
        surfaceId: 'run-action',
        title: 'Run Action',
        action: 'runAction',
      },
    ];
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      extensionCommands,
    };

    await expect(executeExtensionCommand('system-test.run-action', undefined, options)).resolves.toBe(false);
  });

  it('executes core shortcut aliases through host commands', async () => {
    const navigate = vi.fn();
    const toggleSidebar = vi.fn(() => true);
    const findOnPage = vi.fn(() => true);
    const options = {
      navigate,
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      toggleSidebar,
      findOnPage,
    };

    await expect(executeExtensionCommand('core.settings', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('core.toggleSidebar', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('core.findOnPage', undefined, options)).resolves.toBe(true);

    expect(navigate).toHaveBeenCalledWith('/settings');
    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(findOnPage).toHaveBeenCalledTimes(1);
  });

  it('includes command-backed conversation lifecycle actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'conversation.close',
        'conversation.reopenClosed',
        'conversation.togglePinned',
        'conversation.toggleArchived',
        'conversation.rename',
        'conversation.editCwd',
      ]),
    );

    const closeConversation = vi.fn(() => true);
    const reopenClosedConversation = vi.fn(() => true);
    const toggleConversationPin = vi.fn(() => true);
    const toggleConversationArchive = vi.fn(() => true);
    const renameConversation = vi.fn(() => true);
    const editConversationCwd = vi.fn(() => true);

    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
      closeConversation,
      reopenClosedConversation,
      toggleConversationPin,
      toggleConversationArchive,
      renameConversation,
      editConversationCwd,
    };

    await expect(executeExtensionCommand('conversation.close', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.reopenClosed', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.togglePinned', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.toggleArchived', undefined, options)).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.rename', undefined, {
        ...options,
        context: { 'conversation.canRename': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.editCwd', undefined, {
        ...options,
        context: { 'conversation.canEditCwd': true },
      }),
    ).resolves.toBe(true);

    expect(closeConversation).toHaveBeenCalledTimes(1);
    expect(reopenClosedConversation).toHaveBeenCalledTimes(1);
    expect(toggleConversationPin).toHaveBeenCalledTimes(1);
    expect(toggleConversationArchive).toHaveBeenCalledTimes(1);
    expect(renameConversation).toHaveBeenCalledTimes(1);
    expect(editConversationCwd).toHaveBeenCalledTimes(1);
  });

  it('gates conversation navigation on available neighboring conversations', async () => {
    const navigateConversation = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: 'conversation-1',
      navigateConversation,
    };

    await expect(executeExtensionCommand('conversation.next', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.previous', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('conversation.next', undefined, {
        ...options,
        context: { 'conversation.canNavigate': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('conversation.previous', undefined, {
        ...options,
        context: { 'conversation.canNavigate': true },
      }),
    ).resolves.toBe(true);

    expect(navigateConversation).toHaveBeenCalledTimes(2);
    expect(navigateConversation).toHaveBeenNthCalledWith(1, 'next');
    expect(navigateConversation).toHaveBeenNthCalledWith(2, 'previous');
  });

  it('blocks active-conversation commands when no conversation is active', async () => {
    const closeConversation = vi.fn(() => true);
    const toggleConversationPin = vi.fn(() => true);
    const editConversationCwd = vi.fn(() => true);
    const pageConversation = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      activeConversationId: null,
      closeConversation,
      toggleConversationPin,
      editConversationCwd,
      pageConversation,
    };

    await expect(executeExtensionCommand('conversation.close', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.togglePinned', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.editCwd', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.pageUp', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('conversation.pageDown', undefined, options)).resolves.toBe(false);
    expect(closeConversation).not.toHaveBeenCalled();
    expect(toggleConversationPin).not.toHaveBeenCalled();
    expect(editConversationCwd).not.toHaveBeenCalled();
    expect(pageConversation).not.toHaveBeenCalled();
  });

  it('uses command context for active-conversation enablement', async () => {
    const closeConversation = vi.fn(() => true);
    const pageConversation = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      context: { 'conversation.hasActive': true },
      closeConversation,
      pageConversation,
    };

    await expect(executeExtensionCommand('conversation.close', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('conversation.pageDown', undefined, options)).resolves.toBe(true);
    expect(closeConversation).toHaveBeenCalledTimes(1);
    expect(pageConversation).toHaveBeenCalledWith('down');
  });

  it('includes command-backed workbench actions', async () => {
    expect(listHostCommands().map((command) => command.id)).toEqual(
      expect.arrayContaining([
        'workbench.newTab',
        'workbench.closeActiveTab',
        'workbench.closeActiveFile',
        'workbench.refreshActiveFile',
        'workbench.toggleExplorer',
        'workbench.toggleDiff',
      ]),
    );

    const newWorkbenchTab = vi.fn(() => true);
    const closeActiveWorkbenchTab = vi.fn(() => true);
    const closeActiveWorkbenchFile = vi.fn(() => true);
    const refreshActiveWorkbenchFile = vi.fn(() => true);
    const toggleWorkbenchExplorer = vi.fn(() => true);
    const toggleWorkbenchDiff = vi.fn(() => true);
    const options = {
      navigate: vi.fn(),
      openCommandPalette: vi.fn(),
      openRightRail: vi.fn(),
      setLayout: vi.fn(),
      newWorkbenchTab,
      closeActiveWorkbenchTab,
      closeActiveWorkbenchFile,
      refreshActiveWorkbenchFile,
      toggleWorkbenchExplorer,
      toggleWorkbenchDiff,
    };

    await expect(executeExtensionCommand('workbench.newTab', undefined, options)).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.closeActiveTab', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('workbench.closeActiveTab', undefined, {
        ...options,
        context: { 'workbench.hasActiveTab': true },
      }),
    ).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.closeActiveFile', undefined, options)).resolves.toBe(false);
    await expect(executeExtensionCommand('workbench.refreshActiveFile', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('workbench.closeActiveFile', undefined, {
        ...options,
        context: { 'workbench.hasActiveFile': true },
      }),
    ).resolves.toBe(true);
    await expect(
      executeExtensionCommand('workbench.refreshActiveFile', undefined, {
        ...options,
        context: { 'workbench.hasActiveFile': true },
      }),
    ).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.toggleExplorer', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('workbench.toggleExplorer', undefined, {
        ...options,
        context: { 'workbench.canToggleExplorer': true },
      }),
    ).resolves.toBe(true);
    await expect(executeExtensionCommand('workbench.toggleDiff', undefined, options)).resolves.toBe(false);
    await expect(
      executeExtensionCommand('workbench.toggleDiff', undefined, {
        ...options,
        context: { 'workbench.canToggleDiff': true },
      }),
    ).resolves.toBe(true);

    expect(newWorkbenchTab).toHaveBeenCalledTimes(1);
    expect(closeActiveWorkbenchTab).toHaveBeenCalledTimes(1);
    expect(closeActiveWorkbenchFile).toHaveBeenCalledTimes(1);
    expect(refreshActiveWorkbenchFile).toHaveBeenCalledTimes(1);
    expect(toggleWorkbenchExplorer).toHaveBeenCalledTimes(1);
    expect(toggleWorkbenchDiff).toHaveBeenCalledTimes(1);
  });
});
