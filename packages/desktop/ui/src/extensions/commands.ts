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
  openCommandPalette(scope?: string): void;
  openRightRail(target: string): boolean;
  setLayout(mode: 'compact' | 'workbench'): void;
  toggleLayout?(): boolean;
  toggleSidebar?(): boolean;
  toggleRightRail?(): boolean;
  findOnPage?(): boolean;
  focusComposer?(): void;
  focusSidebar?(): void;
  focusNext?(): void;
  focusPrevious?(): void;
  activateSelection?(): void;
  submitComposer?(): boolean;
  clearComposer?(): boolean;
  pageConversation?(direction: 'up' | 'down'): boolean;
  closeConversation?(): boolean;
  reopenClosedConversation?(): boolean;
  toggleConversationPin?(): boolean;
  toggleConversationArchive?(): boolean;
  renameConversation?(): boolean;
  editConversationCwd?(): boolean;
  newWorkbenchTab?(): boolean;
  closeActiveWorkbenchTab?(): boolean;
  closeActiveWorkbenchFile?(): boolean;
  refreshActiveWorkbenchFile?(): boolean;
  toggleWorkbenchExplorer?(): boolean;
  toggleWorkbenchDiff?(): boolean;
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

export function setExtensionCommandContext(key: string, value: ExtensionCommandContextValue): void {
  if (!key.trim()) return;
  if (value === undefined || value === null) extensionCommandContext.delete(key);
  else extensionCommandContext.set(key, value);
  window.dispatchEvent(new CustomEvent('neon-pilot-extension-command-context-changed', { detail: { key, value } }));
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
    { id: 'conversation.editCwd', title: 'Edit Conversation Working Directory', category: 'Conversation' },
    { id: 'composer.focus', title: 'Focus Composer', category: 'Conversation' },
    { id: 'composer.submit', title: 'Send Message', category: 'Conversation' },
    { id: 'composer.clear', title: 'Clear Composer', category: 'Conversation' },
    { id: 'conversation.pageUp', title: 'Page Conversation Up', category: 'Conversation' },
    { id: 'conversation.pageDown', title: 'Page Conversation Down', category: 'Conversation' },
    { id: 'workbench.newTab', title: 'New Workbench Tab', category: 'Workbench' },
    { id: 'workbench.closeActiveTab', title: 'Close Active Workbench Tab', category: 'Workbench' },
    { id: 'workbench.closeActiveFile', title: 'Close Active Workbench File', category: 'Workbench' },
    { id: 'workbench.refreshActiveFile', title: 'Refresh Active Workbench File', category: 'Workbench' },
    { id: 'workbench.toggleExplorer', title: 'Toggle Workbench Explorer', category: 'Workbench' },
    { id: 'workbench.toggleDiff', title: 'Toggle Workbench Diff Overlay', category: 'Workbench' },
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
      id: 'palette.open',
      title: 'Open Command Palette',
      category: 'App',
      execute(args) {
        options.openCommandPalette(readStringArg(args, 'scope') ?? undefined);
        return true;
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
    },
    {
      id: 'layout.toggleSidebar',
      title: 'Toggle Left Sidebar',
      category: 'App',
      execute() {
        return options.toggleSidebar?.() ?? false;
      },
    },
    {
      id: 'layout.toggleRightRail',
      title: 'Toggle Right Rail',
      category: 'App',
      execute() {
        return options.toggleRightRail?.() ?? false;
      },
    },
    {
      id: 'page.find',
      title: 'Find on Page',
      category: 'App',
      execute() {
        return options.findOnPage?.() ?? false;
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
      canExecute(args) {
        return Boolean(readStringArg(args, 'conversationId') ?? options.activeConversationId);
      },
    },
    {
      id: 'conversation.next',
      title: 'Next Conversation',
      category: 'Conversation',
      execute() {
        return options.navigateConversation?.('next') ?? false;
      },
      canExecute() {
        return Boolean(options.activeConversationId);
      },
    },
    {
      id: 'conversation.previous',
      title: 'Previous Conversation',
      category: 'Conversation',
      execute() {
        return options.navigateConversation?.('previous') ?? false;
      },
      canExecute() {
        return Boolean(options.activeConversationId);
      },
    },
    {
      id: 'conversation.close',
      title: 'Close Conversation',
      category: 'Conversation',
      execute() {
        return options.closeConversation?.() ?? false;
      },
    },
    {
      id: 'conversation.reopenClosed',
      title: 'Reopen Closed Conversation',
      category: 'Conversation',
      execute() {
        return options.reopenClosedConversation?.() ?? false;
      },
    },
    {
      id: 'conversation.togglePinned',
      title: 'Pin or Unpin Conversation',
      category: 'Conversation',
      execute() {
        return options.toggleConversationPin?.() ?? false;
      },
      canExecute() {
        return Boolean(options.activeConversationId);
      },
    },
    {
      id: 'conversation.toggleArchived',
      title: 'Archive or Restore Conversation',
      category: 'Conversation',
      execute() {
        return options.toggleConversationArchive?.() ?? false;
      },
      canExecute() {
        return Boolean(options.activeConversationId);
      },
    },
    {
      id: 'conversation.rename',
      title: 'Rename Conversation',
      category: 'Conversation',
      execute() {
        return options.renameConversation?.() ?? false;
      },
      canExecute() {
        return Boolean(options.activeConversationId);
      },
    },
    {
      id: 'conversation.editCwd',
      title: 'Edit Conversation Working Directory',
      category: 'Conversation',
      execute() {
        return options.editConversationCwd?.() ?? false;
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
    },
    {
      id: 'composer.submit',
      title: 'Send Message',
      category: 'Conversation',
      execute() {
        return options.submitComposer?.() ?? false;
      },
    },
    {
      id: 'composer.clear',
      title: 'Clear Composer',
      category: 'Conversation',
      execute() {
        return options.clearComposer?.() ?? false;
      },
    },
    {
      id: 'conversation.pageUp',
      title: 'Page Conversation Up',
      category: 'Conversation',
      execute() {
        return options.pageConversation?.('up') ?? false;
      },
    },
    {
      id: 'conversation.pageDown',
      title: 'Page Conversation Down',
      category: 'Conversation',
      execute() {
        return options.pageConversation?.('down') ?? false;
      },
    },
    {
      id: 'workbench.newTab',
      title: 'New Workbench Tab',
      category: 'Workbench',
      execute() {
        return options.newWorkbenchTab?.() ?? false;
      },
    },
    {
      id: 'workbench.closeActiveTab',
      title: 'Close Active Workbench Tab',
      category: 'Workbench',
      execute() {
        return options.closeActiveWorkbenchTab?.() ?? false;
      },
    },
    {
      id: 'workbench.closeActiveFile',
      title: 'Close Active Workbench File',
      category: 'Workbench',
      execute() {
        return options.closeActiveWorkbenchFile?.() ?? false;
      },
    },
    {
      id: 'workbench.refreshActiveFile',
      title: 'Refresh Active Workbench File',
      category: 'Workbench',
      execute() {
        return options.refreshActiveWorkbenchFile?.() ?? false;
      },
    },
    {
      id: 'workbench.toggleExplorer',
      title: 'Toggle Workbench Explorer',
      category: 'Workbench',
      execute() {
        return options.toggleWorkbenchExplorer?.() ?? false;
      },
    },
    {
      id: 'workbench.toggleDiff',
      title: 'Toggle Workbench Diff Overlay',
      category: 'Workbench',
      execute() {
        return options.toggleWorkbenchDiff?.() ?? false;
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
    },
    {
      id: 'model.cycle',
      title: 'Cycle Model',
      category: 'Model',
      execute() {
        return options.cycleModel?.() ?? false;
      },
    },
    {
      id: 'thinking.cycle',
      title: 'Cycle Thinking Level',
      category: 'Model',
      execute() {
        return options.cycleThinking?.() ?? false;
      },
    },
    {
      id: 'dictation.toggle',
      title: 'Start or Stop Dictation',
      category: 'Dictation',
      execute() {
        return options.toggleDictation?.() ?? false;
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
    },
    {
      id: 'focus.next',
      title: 'Focus Next',
      category: 'Focus',
      execute() {
        if (!options.focusNext) return false;
        options.focusNext();
        return true;
      },
    },
    {
      id: 'focus.previous',
      title: 'Focus Previous',
      category: 'Focus',
      execute() {
        if (!options.focusPrevious) return false;
        options.focusPrevious();
        return true;
      },
    },
    {
      id: 'selection.activate',
      title: 'Activate Selection',
      category: 'Focus',
      execute() {
        if (!options.activateSelection) return false;
        options.activateSelection();
        return true;
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
    const extensionCommand =
      options.extensionCommands?.find((candidate) => `${candidate.extensionId}.${candidate.surfaceId}` === invocation.command) ??
      (() => {
        const bare = options.extensionCommands?.filter((c) => c.surfaceId === invocation.command);
        return bare?.length === 1 ? bare[0] : undefined;
      })();
    if (!extensionCommand) return false;
    if (!evaluateCommandEnablement(extensionCommand.enablement, options.context)) return false;
    const effectiveArgs = commandArgs ?? (extensionCommand.args as ExtensionCommandArgs);
    if (isHostCommandString(extensionCommand.action)) {
      handled = await executeExtensionCommand(extensionCommand.action, effectiveArgs, options);
      return handled;
    }
    await options.invokeExtensionCommand?.(extensionCommand, effectiveArgs ?? {});
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
