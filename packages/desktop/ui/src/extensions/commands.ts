import type { NavigateFunction } from 'react-router-dom';

import { recordRendererTelemetry } from '../telemetry/appTelemetry';
import type { ExtensionCommandRegistration } from './types';

export type ExtensionCommandArgs = Record<string, unknown> | undefined;
export type ExtensionCommandContextValue = string | number | boolean | null | undefined;
export type ExtensionCommandContext = Record<string, ExtensionCommandContextValue>;

export interface HostCommandDefinition {
  id: string;
  title: string;
  category?: string;
  argsSchema?: Record<string, unknown>;
  execute(args: ExtensionCommandArgs): boolean | Promise<boolean>;
  canExecute?(args: ExtensionCommandArgs, context: ExtensionCommandContext): boolean;
}

export interface ExtensionCommandExecutorOptions {
  navigate: NavigateFunction;
  goBack?(): boolean;
  goForward?(): boolean;
  openNotifications?(): boolean;
  closeNotifications?(): boolean;
  markAllNotificationsRead?(): boolean;
  dismissAllNotifications?(): boolean;
  openCommandPalette(scope?: string): void;
  openRightRail(target: string): boolean;
  setLayout(mode: 'compact' | 'workbench'): void;
  toggleLayout?(): boolean;
  toggleSidebar?(): boolean;
  toggleRightRail?(): boolean;
  findOnPage?(): boolean;
  findNextOnPage?(): boolean;
  findPreviousOnPage?(): boolean;
  closePageSearch?(): boolean;
  focusComposer?(): void;
  focusSidebar?(): void;
  focusNext?(): boolean;
  focusPrevious?(): boolean;
  activateSelection?(): boolean;
  submitComposer?(): boolean;
  stopComposer?(): boolean;
  clearComposer?(): boolean;
  openComposerSettings?(): boolean;
  closeComposerSettings?(): boolean;
  pageConversation?(direction: 'up' | 'down'): boolean;
  closeConversation?(): boolean;
  reopenClosedConversation?(): boolean;
  toggleConversationPin?(): boolean;
  toggleConversationArchive?(): boolean;
  renameConversation?(): boolean;
  saveConversationTitle?(): boolean;
  cancelConversationTitleEdit?(): boolean;
  editConversationCwd?(): boolean;
  saveConversationCwd?(): boolean;
  cancelConversationCwdEdit?(): boolean;
  newWorkbenchTab?(): boolean;
  closeActiveWorkbenchTab?(): boolean;
  closeActiveWorkbenchFile?(): boolean;
  refreshActiveWorkbenchFile?(): boolean;
  toggleWorkbenchExplorer?(): boolean;
  toggleWorkbenchDiff?(): boolean;
  browserGoBack?(): boolean;
  browserGoForward?(): boolean;
  browserReloadOrStop?(): boolean;
  browserFocusLocation?(): boolean;
  browserClose?(): boolean;
  artifactCopySource?(): boolean;
  artifactToggleSource?(): boolean;
  artifactToggleFullscreen?(): boolean;
  artifactClose?(): boolean;
  closeImagePreview?(): boolean;
  saveMessageEdit?(): boolean;
  cancelMessageEdit?(): boolean;
  closeDraftWorkspacePicker?(): boolean;
  closeWorkspaceQuickSelect?(): boolean;
  closeExtensionModal?(): boolean;
  cycleModel?(): boolean;
  cycleThinking?(): boolean;
  newConversation?(args?: {
    initialComposerText?: string | null;
    initialPromptText?: string | null;
    cwd?: string | null;
  }): boolean | Promise<boolean>;
  newConversationAndFocus?(args?: {
    initialComposerText?: string | null;
    initialPromptText?: string | null;
    cwd?: string | null;
  }): boolean | Promise<boolean>;
  toggleDictation?(): boolean;
  navigateConversation?(direction: 'next' | 'previous'): boolean;
  activeConversationId?: string | null;
  extensionCommands?: ExtensionCommandRegistration[];
  invokeExtensionCommand?(command: ExtensionCommandRegistration, args: unknown): Promise<unknown>;
  context?: ExtensionCommandContext;
}

export const EXTENSION_COMMAND_CONTEXT_CHANGED_EVENT = 'neon-pilot-extension-command-context-changed';

const extensionCommandContext = new Map<string, ExtensionCommandContextValue>();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readStringArg(args: ExtensionCommandArgs, key: string): string | null {
  const value = asRecord(args)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readContextValue(context: ExtensionCommandContext, key: string): ExtensionCommandContextValue {
  return Object.prototype.hasOwnProperty.call(context, key) ? context[key] : extensionCommandContext.get(key);
}

function hasActiveConversation(options: ExtensionCommandExecutorOptions, context: ExtensionCommandContext): boolean {
  return Boolean(options.activeConversationId ?? readContextValue(context, 'conversation.hasActive'));
}

export function setExtensionCommandContext(key: string, value: ExtensionCommandContextValue): void {
  if (!key.trim()) return;
  if (value === undefined || value === null) extensionCommandContext.delete(key);
  else extensionCommandContext.set(key, value);
  window.dispatchEvent(new CustomEvent(EXTENSION_COMMAND_CONTEXT_CHANGED_EVENT, { detail: { key, value } }));
}

export function evaluateCommandEnablement(expression: string | undefined, context: ExtensionCommandContext = {}): boolean {
  const trimmed = expression?.trim();
  if (!trimmed) return true;
  const negated = trimmed.startsWith('!');
  const body = negated ? trimmed.slice(1).trim() : trimmed;
  const comparison = body.match(/^([A-Za-z0-9_.:-]+)\s*([!=]=)\s*(.+)$/);
  const result = comparison
    ? compareContextValue(readContextValue(context, comparison[1]), comparison[2], comparison[3])
    : Boolean(readContextValue(context, body));
  return negated ? !result : result;
}

function compareContextValue(value: ExtensionCommandContextValue, operator: string, expected: string): boolean {
  const matches = String(value ?? '') === expected.replace(/^[']|[']$/g, '');
  return operator === '!=' ? !matches : matches;
}

export function listHostCommands(): Array<{ id: string; title: string; category?: string; argsSchema?: Record<string, unknown> }> {
  return [
    { id: 'app.navigate', title: 'Navigate', category: 'App', argsSchema: { type: 'object', properties: { to: { type: 'string' } } } },
    { id: 'app.goBack', title: 'Go Back', category: 'App' },
    { id: 'app.goForward', title: 'Go Forward', category: 'App' },
    { id: 'notifications.open', title: 'Open Notifications', category: 'App' },
    { id: 'notifications.close', title: 'Close Notifications', category: 'App' },
    { id: 'notifications.markAllRead', title: 'Mark Notifications Read', category: 'App' },
    { id: 'notifications.dismissAll', title: 'Dismiss Notifications', category: 'App' },
    {
      id: 'palette.open',
      title: 'Open Command Palette',
      category: 'App',
      argsSchema: { type: 'object', properties: { scope: { type: 'string' } } },
    },
    {
      id: 'rail.open',
      title: 'Open Right Rail',
      category: 'App',
      argsSchema: { type: 'object', properties: { extensionId: { type: 'string' }, surfaceId: { type: 'string' } } },
    },
    {
      id: 'layout.set',
      title: 'Set Layout',
      category: 'App',
      argsSchema: { type: 'object', properties: { mode: { enum: ['compact', 'workbench'] } } },
    },
    { id: 'layout.toggle', title: 'Toggle Layout Mode', category: 'App' },
    { id: 'layout.toggleSidebar', title: 'Toggle Left Sidebar', category: 'App' },
    { id: 'layout.toggleRightRail', title: 'Toggle Right Rail', category: 'App' },
    { id: 'page.find', title: 'Find on Page', category: 'App' },
    { id: 'page.findNext', title: 'Find Next Match', category: 'App' },
    { id: 'page.findPrevious', title: 'Find Previous Match', category: 'App' },
    { id: 'page.closeFind', title: 'Close Page Search', category: 'App' },
    {
      id: 'conversation.new',
      title: 'New Conversation',
      category: 'Conversation',
      argsSchema: {
        type: 'object',
        properties: { initialComposerText: { type: 'string' }, initialPromptText: { type: 'string' }, cwd: { type: 'string' } },
      },
    },
    {
      id: 'conversation.open',
      title: 'Open Conversation',
      category: 'Conversation',
      argsSchema: { type: 'object', properties: { conversationId: { type: 'string' } } },
    },
    { id: 'conversation.next', title: 'Next Conversation', category: 'Conversation' },
    { id: 'conversation.previous', title: 'Previous Conversation', category: 'Conversation' },
    { id: 'conversation.close', title: 'Close Conversation', category: 'Conversation' },
    { id: 'conversation.reopenClosed', title: 'Reopen Closed Conversation', category: 'Conversation' },
    { id: 'conversation.togglePinned', title: 'Pin or Unpin Conversation', category: 'Conversation' },
    { id: 'conversation.toggleArchived', title: 'Archive or Restore Conversation', category: 'Conversation' },
    { id: 'conversation.rename', title: 'Rename Conversation', category: 'Conversation' },
    { id: 'conversation.saveTitle', title: 'Save Conversation Title', category: 'Conversation' },
    { id: 'conversation.cancelTitleEdit', title: 'Cancel Title Edit', category: 'Conversation' },
    { id: 'conversation.editCwd', title: 'Edit Conversation Working Directory', category: 'Conversation' },
    { id: 'conversation.saveCwd', title: 'Save Conversation Working Directory', category: 'Conversation' },
    { id: 'conversation.cancelCwdEdit', title: 'Cancel Working Directory Edit', category: 'Conversation' },
    { id: 'composer.focus', title: 'Focus Composer', category: 'Conversation' },
    { id: 'composer.submit', title: 'Send Message', category: 'Conversation' },
    { id: 'composer.stop', title: 'Stop Streaming', category: 'Conversation' },
    { id: 'composer.clear', title: 'Clear Composer', category: 'Conversation' },
    { id: 'composer.openSettings', title: 'Open Composer Settings', category: 'Conversation' },
    { id: 'composer.closeSettings', title: 'Close Composer Settings', category: 'Conversation' },
    { id: 'conversation.pageUp', title: 'Page Conversation Up', category: 'Conversation' },
    { id: 'conversation.pageDown', title: 'Page Conversation Down', category: 'Conversation' },
    { id: 'workbench.newTab', title: 'New Workbench Tab', category: 'Workbench' },
    { id: 'workbench.closeActiveTab', title: 'Close Active Workbench Tab', category: 'Workbench' },
    { id: 'workbench.closeActiveFile', title: 'Close Active Workbench File', category: 'Workbench' },
    { id: 'workbench.refreshActiveFile', title: 'Refresh Active Workbench File', category: 'Workbench' },
    { id: 'workbench.toggleExplorer', title: 'Toggle Workbench Explorer', category: 'Workbench' },
    { id: 'workbench.toggleDiff', title: 'Toggle Workbench Diff Overlay', category: 'Workbench' },
    { id: 'browser.goBack', title: 'Browser Go Back', category: 'Browser' },
    { id: 'browser.goForward', title: 'Browser Go Forward', category: 'Browser' },
    { id: 'browser.reloadOrStop', title: 'Reload or Stop Browser', category: 'Browser' },
    { id: 'browser.focusLocation', title: 'Focus Browser Location', category: 'Browser' },
    { id: 'browser.close', title: 'Close Browser', category: 'Browser' },
    { id: 'artifact.copySource', title: 'Copy Artifact Source', category: 'Artifact' },
    { id: 'artifact.toggleSource', title: 'Show or Hide Artifact Source', category: 'Artifact' },
    { id: 'artifact.toggleFullscreen', title: 'Toggle Artifact Fullscreen', category: 'Artifact' },
    { id: 'artifact.close', title: 'Close Artifact', category: 'Artifact' },
    { id: 'imagePreview.close', title: 'Close Image Preview', category: 'Image Preview' },
    { id: 'messageEdit.save', title: 'Save Message Edit', category: 'Message Edit' },
    { id: 'messageEdit.cancel', title: 'Cancel Message Edit', category: 'Message Edit' },
    { id: 'draftWorkspacePicker.close', title: 'Close Draft Workspace Picker', category: 'Conversation' },
    { id: 'workspaceQuickSelect.close', title: 'Close Workspace Picker', category: 'Conversation' },
    { id: 'extensionModal.close', title: 'Close Extension Modal', category: 'Extensions' },
    {
      id: 'conversation.newAndFocus',
      title: 'New Conversation and Focus Composer',
      category: 'Conversation',
      argsSchema: {
        type: 'object',
        properties: { initialComposerText: { type: 'string' }, initialPromptText: { type: 'string' }, cwd: { type: 'string' } },
      },
    },
    { id: 'model.cycle', title: 'Cycle Model', category: 'Model' },
    { id: 'thinking.cycle', title: 'Cycle Thinking Level', category: 'Model' },
    { id: 'dictation.toggle', title: 'Start or Stop Dictation', category: 'Dictation' },
    { id: 'sidebar.focus', title: 'Focus Sidebar', category: 'Focus' },
    { id: 'focus.next', title: 'Focus Next', category: 'Focus' },
    { id: 'focus.previous', title: 'Focus Previous', category: 'Focus' },
    { id: 'selection.activate', title: 'Activate Selection', category: 'Focus' },
  ];
}

export function createHostCommands(options: ExtensionCommandExecutorOptions): HostCommandDefinition[] {
  return [
    {
      id: 'app.navigate',
      title: 'Navigate',
      category: 'App',
      execute(args) {
        const to = readStringArg(args, 'to');
        if (!to) return false;
        options.navigate(to);
        return true;
      },
    },
    {
      id: 'app.goBack',
      title: 'Go Back',
      category: 'App',
      execute() {
        return options.goBack?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.goBack) && readContextValue(context, 'app.canGoBack') === true;
      },
    },
    {
      id: 'app.goForward',
      title: 'Go Forward',
      category: 'App',
      execute() {
        return options.goForward?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.goForward) && readContextValue(context, 'app.canGoForward') === true;
      },
    },
    {
      id: 'palette.open',
      title: 'Open Command Palette',
      category: 'App',
      execute(args) {
        options.openCommandPalette(readStringArg(args, 'scope') ?? undefined);
        return true;
      },
    },
    {
      id: 'notifications.open',
      title: 'Open Notifications',
      category: 'App',
      execute() {
        return options.openNotifications?.() ?? false;
      },
      canExecute() {
        return Boolean(options.openNotifications);
      },
    },
    {
      id: 'notifications.close',
      title: 'Close Notifications',
      category: 'App',
      execute() {
        return options.closeNotifications?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closeNotifications) && readContextValue(context, 'notifications.open') === true;
      },
    },
    {
      id: 'notifications.markAllRead',
      title: 'Mark Notifications Read',
      category: 'App',
      execute() {
        return options.markAllNotificationsRead?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.markAllNotificationsRead) && readContextValue(context, 'notifications.hasUnread') === true;
      },
    },
    {
      id: 'notifications.dismissAll',
      title: 'Dismiss Notifications',
      category: 'App',
      execute() {
        return options.dismissAllNotifications?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.dismissAllNotifications) && readContextValue(context, 'notifications.hasVisible') === true;
      },
    },
    {
      id: 'rail.open',
      title: 'Open Right Rail',
      category: 'App',
      execute(args) {
        const target = readStringArg(args, 'target');
        if (target) return options.openRightRail(target);
        const extensionId = readStringArg(args, 'extensionId');
        const surfaceId = readStringArg(args, 'surfaceId');
        return extensionId && surfaceId ? options.openRightRail(`${extensionId}/${surfaceId}`) : false;
      },
    },
    {
      id: 'layout.set',
      title: 'Set Layout',
      category: 'App',
      execute(args) {
        const mode = readStringArg(args, 'mode');
        if (mode !== 'compact' && mode !== 'workbench') return false;
        options.setLayout(mode);
        return true;
      },
    },
    {
      id: 'layout.toggle',
      title: 'Toggle Layout Mode',
      category: 'App',
      execute() {
        return options.toggleLayout?.() ?? false;
      },
      canExecute() {
        return Boolean(options.toggleLayout);
      },
    },
    {
      id: 'layout.toggleSidebar',
      title: 'Toggle Left Sidebar',
      category: 'App',
      execute() {
        return options.toggleSidebar?.() ?? false;
      },
      canExecute() {
        return Boolean(options.toggleSidebar);
      },
    },
    {
      id: 'layout.toggleRightRail',
      title: 'Toggle Right Rail',
      category: 'App',
      execute() {
        return options.toggleRightRail?.() ?? false;
      },
      canExecute() {
        return Boolean(options.toggleRightRail);
      },
    },
    {
      id: 'page.find',
      title: 'Find on Page',
      category: 'App',
      execute() {
        return options.findOnPage?.() ?? false;
      },
      canExecute() {
        return Boolean(options.findOnPage);
      },
    },
    {
      id: 'page.findNext',
      title: 'Find Next Match',
      category: 'App',
      execute() {
        return options.findNextOnPage?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.findNextOnPage) && readContextValue(context, 'pageSearch.hasMatches') === true;
      },
    },
    {
      id: 'page.findPrevious',
      title: 'Find Previous Match',
      category: 'App',
      execute() {
        return options.findPreviousOnPage?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.findPreviousOnPage) && readContextValue(context, 'pageSearch.hasMatches') === true;
      },
    },
    {
      id: 'page.closeFind',
      title: 'Close Page Search',
      category: 'App',
      execute() {
        return options.closePageSearch?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closePageSearch) && readContextValue(context, 'pageSearch.open') === true;
      },
    },
    {
      id: 'conversation.new',
      title: 'New Conversation',
      category: 'Conversation',
      execute(args) {
        if (options.newConversation) {
          return options.newConversation({
            initialComposerText: readStringArg(args, 'initialComposerText'),
            initialPromptText: readStringArg(args, 'initialPromptText'),
            cwd: readStringArg(args, 'cwd'),
          });
        }
        options.navigate('/conversations/new');
        return true;
      },
    },
    {
      id: 'conversation.open',
      title: 'Open Conversation',
      category: 'Conversation',
      execute(args) {
        const conversationId = readStringArg(args, 'conversationId') ?? options.activeConversationId;
        if (!conversationId) return false;
        options.navigate(`/conversations/${encodeURIComponent(conversationId)}`);
        return true;
      },
      canExecute(args, context) {
        return Boolean(readStringArg(args, 'conversationId') ?? hasActiveConversation(options, context));
      },
    },
    {
      id: 'conversation.next',
      title: 'Next Conversation',
      category: 'Conversation',
      execute() {
        return options.navigateConversation?.('next') ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.navigateConversation) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.previous',
      title: 'Previous Conversation',
      category: 'Conversation',
      execute() {
        return options.navigateConversation?.('previous') ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.navigateConversation) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.close',
      title: 'Close Conversation',
      category: 'Conversation',
      execute() {
        return options.closeConversation?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closeConversation) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.reopenClosed',
      title: 'Reopen Closed Conversation',
      category: 'Conversation',
      execute() {
        return options.reopenClosedConversation?.() ?? false;
      },
      canExecute() {
        return Boolean(options.reopenClosedConversation);
      },
    },
    {
      id: 'conversation.togglePinned',
      title: 'Pin or Unpin Conversation',
      category: 'Conversation',
      execute() {
        return options.toggleConversationPin?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.toggleConversationPin) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.toggleArchived',
      title: 'Archive or Restore Conversation',
      category: 'Conversation',
      execute() {
        return options.toggleConversationArchive?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.toggleConversationArchive) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.rename',
      title: 'Rename Conversation',
      category: 'Conversation',
      execute() {
        return options.renameConversation?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.renameConversation) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.saveTitle',
      title: 'Save Conversation Title',
      category: 'Conversation',
      execute() {
        return options.saveConversationTitle?.() ?? false;
      },
      canExecute(_args, context) {
        return (
          Boolean(options.saveConversationTitle) &&
          hasActiveConversation(options, context) &&
          readContextValue(context, 'conversation.titleEditorOpen') === true &&
          readContextValue(context, 'conversation.titleEditorBusy') !== true
        );
      },
    },
    {
      id: 'conversation.cancelTitleEdit',
      title: 'Cancel Title Edit',
      category: 'Conversation',
      execute() {
        return options.cancelConversationTitleEdit?.() ?? false;
      },
      canExecute(_args, context) {
        return (
          Boolean(options.cancelConversationTitleEdit) &&
          hasActiveConversation(options, context) &&
          readContextValue(context, 'conversation.titleEditorOpen') === true &&
          readContextValue(context, 'conversation.titleEditorBusy') !== true
        );
      },
    },
    {
      id: 'conversation.editCwd',
      title: 'Edit Conversation Working Directory',
      category: 'Conversation',
      execute() {
        return options.editConversationCwd?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.editConversationCwd) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.saveCwd',
      title: 'Save Conversation Working Directory',
      category: 'Conversation',
      execute() {
        return options.saveConversationCwd?.() ?? false;
      },
      canExecute(_args, context) {
        return (
          Boolean(options.saveConversationCwd) &&
          hasActiveConversation(options, context) &&
          readContextValue(context, 'conversation.cwdEditorOpen') === true &&
          readContextValue(context, 'conversation.cwdEditorBusy') !== true
        );
      },
    },
    {
      id: 'conversation.cancelCwdEdit',
      title: 'Cancel Working Directory Edit',
      category: 'Conversation',
      execute() {
        return options.cancelConversationCwdEdit?.() ?? false;
      },
      canExecute(_args, context) {
        return (
          Boolean(options.cancelConversationCwdEdit) &&
          hasActiveConversation(options, context) &&
          readContextValue(context, 'conversation.cwdEditorOpen') === true &&
          readContextValue(context, 'conversation.cwdEditorBusy') !== true
        );
      },
    },
    {
      id: 'composer.focus',
      title: 'Focus Composer',
      category: 'Conversation',
      execute() {
        if (!options.focusComposer) return false;
        options.focusComposer();
        return true;
      },
      canExecute() {
        return Boolean(options.focusComposer);
      },
    },
    {
      id: 'composer.submit',
      title: 'Send Message',
      category: 'Conversation',
      execute() {
        return options.submitComposer?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.submitComposer) && readContextValue(context, 'composer.canSubmit') === true;
      },
    },
    {
      id: 'composer.stop',
      title: 'Stop Streaming',
      category: 'Conversation',
      execute() {
        return options.stopComposer?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.stopComposer) && readContextValue(context, 'conversation.isStreaming') === true;
      },
    },
    {
      id: 'composer.clear',
      title: 'Clear Composer',
      category: 'Conversation',
      execute() {
        return options.clearComposer?.() ?? false;
      },
      canExecute() {
        return Boolean(options.clearComposer);
      },
    },
    {
      id: 'composer.openSettings',
      title: 'Open Composer Settings',
      category: 'Conversation',
      execute() {
        return options.openComposerSettings?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.openComposerSettings) && readContextValue(context, 'composer.settingsAvailable') === true;
      },
    },
    {
      id: 'composer.closeSettings',
      title: 'Close Composer Settings',
      category: 'Conversation',
      execute() {
        return options.closeComposerSettings?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closeComposerSettings) && readContextValue(context, 'composer.settingsOpen') === true;
      },
    },
    {
      id: 'conversation.pageUp',
      title: 'Page Conversation Up',
      category: 'Conversation',
      execute() {
        return options.pageConversation?.('up') ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.pageConversation) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'conversation.pageDown',
      title: 'Page Conversation Down',
      category: 'Conversation',
      execute() {
        return options.pageConversation?.('down') ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.pageConversation) && hasActiveConversation(options, context);
      },
    },
    {
      id: 'workbench.newTab',
      title: 'New Workbench Tab',
      category: 'Workbench',
      execute() {
        return options.newWorkbenchTab?.() ?? false;
      },
      canExecute() {
        return Boolean(options.newWorkbenchTab);
      },
    },
    {
      id: 'workbench.closeActiveTab',
      title: 'Close Active Workbench Tab',
      category: 'Workbench',
      execute() {
        return options.closeActiveWorkbenchTab?.() ?? false;
      },
      canExecute() {
        return Boolean(options.closeActiveWorkbenchTab);
      },
    },
    {
      id: 'workbench.closeActiveFile',
      title: 'Close Active Workbench File',
      category: 'Workbench',
      execute() {
        return options.closeActiveWorkbenchFile?.() ?? false;
      },
      canExecute() {
        return Boolean(options.closeActiveWorkbenchFile);
      },
    },
    {
      id: 'workbench.refreshActiveFile',
      title: 'Refresh Active Workbench File',
      category: 'Workbench',
      execute() {
        return options.refreshActiveWorkbenchFile?.() ?? false;
      },
      canExecute() {
        return Boolean(options.refreshActiveWorkbenchFile);
      },
    },
    {
      id: 'workbench.toggleExplorer',
      title: 'Toggle Workbench Explorer',
      category: 'Workbench',
      execute() {
        return options.toggleWorkbenchExplorer?.() ?? false;
      },
      canExecute() {
        return Boolean(options.toggleWorkbenchExplorer);
      },
    },
    {
      id: 'workbench.toggleDiff',
      title: 'Toggle Workbench Diff Overlay',
      category: 'Workbench',
      execute() {
        return options.toggleWorkbenchDiff?.() ?? false;
      },
      canExecute() {
        return Boolean(options.toggleWorkbenchDiff);
      },
    },
    {
      id: 'browser.goBack',
      title: 'Browser Go Back',
      category: 'Browser',
      execute() {
        return options.browserGoBack?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.browserGoBack) && readContextValue(context, 'browser.canGoBack') === true;
      },
    },
    {
      id: 'browser.goForward',
      title: 'Browser Go Forward',
      category: 'Browser',
      execute() {
        return options.browserGoForward?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.browserGoForward) && readContextValue(context, 'browser.canGoForward') === true;
      },
    },
    {
      id: 'browser.reloadOrStop',
      title: 'Reload or Stop Browser',
      category: 'Browser',
      execute() {
        return options.browserReloadOrStop?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.browserReloadOrStop) && readContextValue(context, 'browser.active') === true;
      },
    },
    {
      id: 'browser.focusLocation',
      title: 'Focus Browser Location',
      category: 'Browser',
      execute() {
        return options.browserFocusLocation?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.browserFocusLocation) && readContextValue(context, 'browser.active') === true;
      },
    },
    {
      id: 'browser.close',
      title: 'Close Browser',
      category: 'Browser',
      execute() {
        return options.browserClose?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.browserClose) && readContextValue(context, 'browser.active') === true;
      },
    },
    {
      id: 'artifact.copySource',
      title: 'Copy Artifact Source',
      category: 'Artifact',
      execute() {
        return options.artifactCopySource?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.artifactCopySource) && readContextValue(context, 'artifact.active') === true;
      },
    },
    {
      id: 'artifact.toggleSource',
      title: 'Show or Hide Artifact Source',
      category: 'Artifact',
      execute() {
        return options.artifactToggleSource?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.artifactToggleSource) && readContextValue(context, 'artifact.canShowSource') === true;
      },
    },
    {
      id: 'artifact.toggleFullscreen',
      title: 'Toggle Artifact Fullscreen',
      category: 'Artifact',
      execute() {
        return options.artifactToggleFullscreen?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.artifactToggleFullscreen) && readContextValue(context, 'artifact.active') === true;
      },
    },
    {
      id: 'artifact.close',
      title: 'Close Artifact',
      category: 'Artifact',
      execute() {
        return options.artifactClose?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.artifactClose) && readContextValue(context, 'artifact.active') === true;
      },
    },
    {
      id: 'imagePreview.close',
      title: 'Close Image Preview',
      category: 'Image Preview',
      execute() {
        return options.closeImagePreview?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closeImagePreview) && readContextValue(context, 'imagePreview.active') === true;
      },
    },
    {
      id: 'messageEdit.save',
      title: 'Save Message Edit',
      category: 'Message Edit',
      execute() {
        return options.saveMessageEdit?.() ?? false;
      },
      canExecute(_args, context) {
        return (
          Boolean(options.saveMessageEdit) &&
          readContextValue(context, 'messageEdit.active') === true &&
          readContextValue(context, 'messageEdit.canSave') === true
        );
      },
    },
    {
      id: 'messageEdit.cancel',
      title: 'Cancel Message Edit',
      category: 'Message Edit',
      execute() {
        return options.cancelMessageEdit?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.cancelMessageEdit) && readContextValue(context, 'messageEdit.active') === true;
      },
    },
    {
      id: 'draftWorkspacePicker.close',
      title: 'Close Draft Workspace Picker',
      category: 'Conversation',
      execute() {
        return options.closeDraftWorkspacePicker?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closeDraftWorkspacePicker) && readContextValue(context, 'draftWorkspacePicker.open') === true;
      },
    },
    {
      id: 'workspaceQuickSelect.close',
      title: 'Close Workspace Picker',
      category: 'Conversation',
      execute() {
        return options.closeWorkspaceQuickSelect?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closeWorkspaceQuickSelect) && readContextValue(context, 'workspaceQuickSelect.open') === true;
      },
    },
    {
      id: 'extensionModal.close',
      title: 'Close Extension Modal',
      category: 'Extensions',
      execute() {
        return options.closeExtensionModal?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.closeExtensionModal) && readContextValue(context, 'extensionModal.open') === true;
      },
    },
    {
      id: 'conversation.newAndFocus',
      title: 'New Conversation and Focus Composer',
      category: 'Conversation',
      execute(args) {
        return (
          options.newConversationAndFocus?.({
            initialComposerText: readStringArg(args, 'initialComposerText'),
            initialPromptText: readStringArg(args, 'initialPromptText'),
            cwd: readStringArg(args, 'cwd'),
          }) ?? false
        );
      },
      canExecute() {
        return Boolean(options.newConversationAndFocus);
      },
    },
    {
      id: 'model.cycle',
      title: 'Cycle Model',
      category: 'Model',
      execute() {
        return options.cycleModel?.() ?? false;
      },
      canExecute() {
        return Boolean(options.cycleModel);
      },
    },
    {
      id: 'thinking.cycle',
      title: 'Cycle Thinking Level',
      category: 'Model',
      execute() {
        return options.cycleThinking?.() ?? false;
      },
      canExecute() {
        return Boolean(options.cycleThinking);
      },
    },
    {
      id: 'dictation.toggle',
      title: 'Start or Stop Dictation',
      category: 'Dictation',
      execute() {
        return options.toggleDictation?.() ?? false;
      },
      canExecute(_args, context) {
        return Boolean(options.toggleDictation) && readContextValue(context, 'system-local-dictation.toggleAvailable') === true;
      },
    },
    {
      id: 'sidebar.focus',
      title: 'Focus Sidebar',
      category: 'Focus',
      execute() {
        if (!options.focusSidebar) return false;
        options.focusSidebar();
        return true;
      },
      canExecute() {
        return Boolean(options.focusSidebar);
      },
    },
    {
      id: 'focus.next',
      title: 'Focus Next',
      category: 'Focus',
      execute() {
        return options.focusNext?.() ?? false;
      },
      canExecute() {
        return Boolean(options.focusNext);
      },
    },
    {
      id: 'focus.previous',
      title: 'Focus Previous',
      category: 'Focus',
      execute() {
        return options.focusPrevious?.() ?? false;
      },
      canExecute() {
        return Boolean(options.focusPrevious);
      },
    },
    {
      id: 'selection.activate',
      title: 'Activate Selection',
      category: 'Focus',
      execute() {
        return options.activateSelection?.() ?? false;
      },
      canExecute() {
        return Boolean(options.activateSelection);
      },
    },
  ];
}

export function normalizeLegacyCommand(command: string): { command: string; args?: Record<string, unknown> } {
  if (command === 'core.newConversation') return { command: 'conversation.new' };
  if (command === 'core.closeTab') return { command: 'conversation.close' };
  if (command === 'core.reopenClosedTab') return { command: 'conversation.reopenClosed' };
  if (command === 'core.previousConversation') return { command: 'conversation.previous' };
  if (command === 'core.nextConversation') return { command: 'conversation.next' };
  if (command === 'core.togglePinned') return { command: 'conversation.togglePinned' };
  if (command === 'core.archiveRestoreConversation') return { command: 'conversation.toggleArchived' };
  if (command === 'core.renameConversation') return { command: 'conversation.rename' };
  if (command === 'core.focusComposer') return { command: 'composer.focus' };
  if (command === 'core.editWorkingDirectory') return { command: 'conversation.editCwd' };
  if (command === 'core.findOnPage') return { command: 'page.find' };
  if (command === 'core.settings') return { command: 'app.navigate', args: { to: '/settings' } };
  if (command === 'core.toggleSidebar') return { command: 'layout.toggleSidebar' };
  if (command === 'core.toggleRightRail') return { command: 'layout.toggleRightRail' };
  if (command.startsWith('navigate:')) return { command: 'app.navigate', args: { to: command.slice('navigate:'.length) } };
  if (command.startsWith('commandPalette:')) return { command: 'palette.open', args: { scope: command.slice('commandPalette:'.length) } };
  if (command.startsWith('rightRail:')) {
    const [extensionId, surfaceId] = command.slice('rightRail:'.length).split('/');
    return { command: 'rail.open', args: { extensionId, surfaceId } };
  }
  if (command.startsWith('layout:')) return { command: 'layout.set', args: { mode: command.slice('layout:'.length) } };
  return { command };
}

function isHostCommandString(command: string): boolean {
  const normalized = normalizeLegacyCommand(command).command;
  return listHostCommands().some((candidate) => candidate.id === normalized);
}

function findExtensionCommand(command: string, options: ExtensionCommandExecutorOptions): ExtensionCommandRegistration | undefined {
  return (
    options.extensionCommands?.find((candidate) => `${candidate.extensionId}.${candidate.surfaceId}` === command) ??
    (() => {
      const bare = options.extensionCommands?.filter((candidate) => candidate.surfaceId === command);
      return bare?.length === 1 ? bare[0] : undefined;
    })()
  );
}

export function canExecuteExtensionCommand(command: string, args: unknown, options: ExtensionCommandExecutorOptions): boolean {
  const invocation = normalizeLegacyCommand(command);
  const commandArgs = (args ?? invocation.args) as ExtensionCommandArgs;
  const hostCommand = createHostCommands(options).find((candidate) => candidate.id === invocation.command);
  if (hostCommand) {
    return hostCommand.canExecute ? hostCommand.canExecute(commandArgs, options.context ?? {}) : true;
  }

  const extensionCommand = findExtensionCommand(invocation.command, options);
  if (!extensionCommand) return false;
  if (!evaluateCommandEnablement(extensionCommand.enablement, options.context)) return false;
  const effectiveArgs = commandArgs ?? (extensionCommand.args as ExtensionCommandArgs);
  if (isHostCommandString(extensionCommand.action)) {
    return canExecuteExtensionCommand(extensionCommand.action, effectiveArgs, options);
  }
  return Boolean(options.invokeExtensionCommand);
}

export async function executeExtensionCommand(command: string, args: unknown, options: ExtensionCommandExecutorOptions): Promise<boolean> {
  const startedAt = performance.now();
  const invocation = normalizeLegacyCommand(command);
  const commandArgs = (args ?? invocation.args) as ExtensionCommandArgs;
  let handled = false;
  try {
    const hostCommand = createHostCommands(options).find((candidate) => candidate.id === invocation.command);
    if (hostCommand) {
      if (hostCommand.canExecute && !hostCommand.canExecute(commandArgs, options.context ?? {})) return false;
      handled = Boolean(await hostCommand.execute(commandArgs));
      return handled;
    }
    // Prefer scoped match (extensionId.surfaceId) over bare surfaceId to avoid
    // cross-extension collisions. Bare matches are only accepted when unambiguous.
    const extensionCommand = findExtensionCommand(invocation.command, options);
    if (!extensionCommand) return false;
    if (!evaluateCommandEnablement(extensionCommand.enablement, options.context)) return false;
    const effectiveArgs = commandArgs ?? (extensionCommand.args as ExtensionCommandArgs);
    if (isHostCommandString(extensionCommand.action)) {
      handled = await executeExtensionCommand(extensionCommand.action, effectiveArgs, options);
      return handled;
    }
    if (!options.invokeExtensionCommand) return false;
    await options.invokeExtensionCommand(extensionCommand, effectiveArgs ?? {});
    handled = true;
    return true;
  } finally {
    recordRendererTelemetry({
      category: 'commands',
      name: 'execute',
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      metadata: { command: invocation.command, originalCommand: command, handled },
    });
  }
}
