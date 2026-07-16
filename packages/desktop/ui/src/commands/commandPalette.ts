import type { LauncherPinTarget } from '../applications/launcherPins';
import { evaluateCommandEnablement, type ExtensionCommandContext } from '../extensions/commands';
import { fuzzyScore } from './slashMenu';

export type CommandPaletteSection = string;
export type CommandPaletteScope = string;

export const THREADS_COMMAND_PALETTE_SCOPE = 'threads';
export const ALL_COMMAND_PALETTE_SCOPE = 'all';

export interface CommandPaletteItem<TAction = unknown> {
  id: string;
  section: CommandPaletteSection;
  title: string;
  subtitle?: string;
  icon?: string;
  parentLabel?: string;
  auxiliaryLabel?: string;
  pinTarget?: LauncherPinTarget;
  meta?: string;
  keywords?: string[];
  order?: number;
  disabled?: boolean;
  action: TAction;
}

interface CommandPaletteResultItem<TAction = unknown> extends CommandPaletteItem<TAction> {
  score: number;
}

interface CommandPaletteSectionResult<TAction = unknown> {
  section: CommandPaletteSection;
  label: string;
  items: CommandPaletteResultItem<TAction>[];
  total: number;
}

export const THREAD_COMMAND_PALETTE_SECTIONS: CommandPaletteSection[] = ['open', 'archived'];

export const COMMAND_PALETTE_SECTION_LABELS: Record<CommandPaletteSection, string> = {
  applications: 'Applications',
  pages: 'Pages',
  open: 'Open threads',
  commands: 'Commands',
  archived: 'Archived threads',
};

export const COMMAND_PALETTE_SCOPE_OPTIONS: Array<{ value: CommandPaletteScope; label: string }> = [
  { value: ALL_COMMAND_PALETTE_SCOPE, label: 'All' },
  { value: THREADS_COMMAND_PALETTE_SCOPE, label: 'Threads' },
];

const ACTIVE_CONVERSATION_HOST_COMMANDS = new Set([
  'conversation.open',
  'conversation.close',
  'conversation.togglePinned',
  'conversation.toggleArchived',
  'conversation.rename',
  'conversation.duplicate',
  'conversation.copyWorkingDirectory',
  'conversation.copyId',
  'conversation.copyDeeplink',
  'conversation.saveTitle',
  'conversation.cancelTitleEdit',
  'conversation.editCwd',
  'conversation.saveCwd',
  'conversation.cancelCwdEdit',
  'conversation.pageUp',
  'conversation.pageDown',
]);

const ARGUMENT_REQUIRED_HOST_COMMANDS = new Set(['app.navigate', 'rail.open', 'layout.set']);

const CONTEXT_REQUIRED_HOST_COMMANDS = new Map([
  ['app.goBack', 'app.canGoBack'],
  ['app.goForward', 'app.canGoForward'],
  ['page.findNext', 'pageSearch.hasMatches'],
  ['page.findPrevious', 'pageSearch.hasMatches'],
  ['page.closeFind', 'pageSearch.open'],
  ['conversation.rename', 'conversation.canRename'],
  ['conversation.copyWorkingDirectory', 'conversation.hasCwd'],
  ['conversation.saveTitle', 'conversation.titleEditorOpen'],
  ['conversation.cancelTitleEdit', 'conversation.titleEditorOpen'],
  ['layout.toggleRightRail', 'layout.canToggleRightSidebar'],
  ['conversation.next', 'conversation.canNavigate'],
  ['conversation.previous', 'conversation.canNavigate'],
  ['conversation.editCwd', 'conversation.canEditCwd'],
  ['notifications.close', 'notifications.open'],
  ['notifications.markAllRead', 'notifications.hasUnread'],
  ['notifications.dismissAll', 'notifications.hasVisible'],
  ['setup.close', 'setup.open'],
  ['browser.newTab', 'browser.active'],
  ['browser.reopenTab', 'browser.active'],
  ['browser.closeTab', 'browser.active'],
  ['browser.goBack', 'browser.canGoBack'],
  ['browser.goForward', 'browser.canGoForward'],
  ['browser.reloadOrStop', 'browser.active'],
  ['browser.focusLocation', 'browser.active'],
  ['browser.close', 'browser.active'],
  ['artifact.copySource', 'artifact.active'],
  ['artifact.toggleSource', 'artifact.canShowSource'],
  ['artifact.toggleFullscreen', 'artifact.active'],
  ['artifact.close', 'artifact.active'],
  ['imagePreview.close', 'imagePreview.active'],
  ['imagePreview.inspectFirst', 'imagePreview.canInspectFirst'],
  ['imagePreview.loadFirst', 'imagePreview.canLoadFirst'],
  ['fileChange.toggleFirst', 'fileChange.canToggleFirst'],
  ['toolBlock.toggleFirst', 'toolBlock.canToggleFirst'],
  ['toolBlock.toggleFirstLinkedRuns', 'toolBlock.canToggleFirstLinkedRuns'],
  ['traceCluster.toggleFirst', 'traceCluster.canToggleFirst'],
  ['traceCluster.toggleFirstOverflow', 'traceCluster.canToggleFirstOverflow'],
  ['inlineTraceRun.toggleFirst', 'inlineTraceRun.canToggleFirst'],
  ['thinkingBlock.toggleFirst', 'thinkingBlock.canToggleFirst'],
  ['subagentBlock.toggleFirst', 'subagentBlock.canToggleFirst'],
  ['messageAction.copyFirst', 'messageAction.canCopyFirst'],
  ['messageAction.editFirst', 'messageAction.canEditFirst'],
  ['messageAction.rewindFirst', 'messageAction.canRewindFirst'],
  ['messageAction.forkFirst', 'messageAction.canForkFirst'],
  ['messageEdit.save', 'messageEdit.canSave'],
  ['messageEdit.cancel', 'messageEdit.active'],
  ['drawingPicker.open', 'drawingPicker.available'],
  ['drawingPicker.close', 'drawingPicker.open'],
  ['drawingPicker.attachFirst', 'drawingPicker.hasVisibleDrawing'],
  ['drawingPicker.toggleFirstHistory', 'drawingPicker.hasVisibleDrawing'],
  ['draftWorkspacePicker.open', 'draftWorkspacePicker.available'],
  ['draftWorkspacePicker.toggle', 'draftWorkspacePicker.available'],
  ['draftWorkspacePicker.close', 'draftWorkspacePicker.open'],
  ['workspaceQuickSelect.close', 'workspaceQuickSelect.open'],
  ['extensionModal.close', 'extensionModal.open'],
  ['conversation.saveCwd', 'conversation.cwdEditorOpen'],
  ['conversation.cancelCwdEdit', 'conversation.cwdEditorOpen'],
  ['conversation.cancelGoal', 'conversation.goalActive'],
  ['conversation.continueDeferredResumes', 'conversation.canContinueDeferredResumes'],
  ['conversation.toggleBackgroundRunDetails', 'conversation.hasBackgroundRuns'],
  ['conversation.toggleDeferredResumeDetails', 'conversation.hasDeferredResumes'],
  ['conversation.toggleScheduledTaskDetails', 'conversation.hasScheduledTasks'],
  ['conversation.openLatestBackgroundRun', 'conversation.canOpenLatestBackgroundRun'],
  ['conversation.cancelLatestBackgroundRun', 'conversation.canCancelLatestBackgroundRun'],
  ['conversation.runFirstScheduledTask', 'conversation.canRunFirstScheduledTask'],
  ['conversation.openFirstScheduledTask', 'conversation.canOpenFirstScheduledTask'],
  ['conversation.fireFirstDeferredResume', 'conversation.canFireFirstDeferredResume'],
  ['conversation.cancelFirstDeferredResume', 'conversation.canCancelFirstDeferredResume'],
  ['conversation.restoreFirstQueuedPrompt', 'conversation.canRestoreFirstQueuedPrompt'],
  ['conversation.openActiveCheckpoint', 'conversation.canOpenActiveCheckpoint'],
  ['conversation.openLatestCheckpoint', 'conversation.canOpenLatestCheckpoint'],
  ['conversation.scrollFirstCheckpointFile', 'conversation.canScrollFirstCheckpointFile'],
  ['workbench.closeActiveTab', 'workbench.hasActiveTab'],
  ['workbench.promoteActiveChatTab', 'workbench.hasActiveChatTab'],
  ['workbench.closeActiveFile', 'workbench.hasActiveFile'],
  ['workbench.refreshActiveFile', 'workbench.hasActiveFile'],
  ['workbench.toggleExplorer', 'workbench.canToggleExplorer'],
  ['workbench.toggleDiff', 'workbench.canToggleDiff'],
  ['composer.submit', 'composer.canSubmit'],
  ['composer.clear', 'composer.canClear'],
  ['composer.stop', 'conversation.isStreaming'],
  ['composer.openSettings', 'composer.settingsAvailable'],
  ['composer.closeSettings', 'composer.settingsOpen'],
  ['composer.openPreferences', 'composer.preferencesAvailable'],
  ['composer.togglePreferences', 'composer.preferencesAvailable'],
  ['composer.closePreferences', 'composer.preferencesOpen'],
  ['composer.previewFirstAttachment', 'composer.canPreviewFirstAttachment'],
  ['composer.removeFirstAttachment', 'composer.canRemoveFirstAttachment'],
  ['composer.createDrawing', 'composer.canCreateDrawing'],
  ['composer.previewFirstDrawing', 'composer.canPreviewFirstDrawing'],
  ['composer.editFirstDrawing', 'composer.canEditFirstDrawing'],
  ['composer.removeFirstDrawing', 'composer.canRemoveFirstDrawing'],
  ['dictation.toggle', 'system-local-dictation.toggleAvailable'],
]);

const CONTEXT_BLOCKED_HOST_COMMANDS = new Map([
  ['conversation.saveTitle', 'conversation.titleEditorBusy'],
  ['conversation.cancelTitleEdit', 'conversation.titleEditorBusy'],
  ['conversation.saveCwd', 'conversation.cwdEditorBusy'],
  ['conversation.cancelCwdEdit', 'conversation.cwdEditorBusy'],
]);

export function listCommandPaletteGatedHostCommandIds(): string[] {
  return [
    ...new Set([
      ...ACTIVE_CONVERSATION_HOST_COMMANDS,
      ...ARGUMENT_REQUIRED_HOST_COMMANDS,
      ...CONTEXT_REQUIRED_HOST_COMMANDS.keys(),
      ...CONTEXT_BLOCKED_HOST_COMMANDS.keys(),
    ]),
  ];
}

export function isHostCommandDisabledInPalette(
  commandId: string,
  options: { activeConversationId?: string | null; context?: ExtensionCommandContext },
): boolean {
  if (ARGUMENT_REQUIRED_HOST_COMMANDS.has(commandId)) {
    return true;
  }

  if (ACTIVE_CONVERSATION_HOST_COMMANDS.has(commandId) && !options.activeConversationId) {
    return true;
  }

  const requiredContext = CONTEXT_REQUIRED_HOST_COMMANDS.get(commandId);
  if (requiredContext && !evaluateCommandEnablement(requiredContext, options.context)) {
    return true;
  }

  const blockedContext = CONTEXT_BLOCKED_HOST_COMMANDS.get(commandId);
  return blockedContext ? evaluateCommandEnablement(blockedContext, options.context) : false;
}

export function shouldBootstrapCommandPaletteThreads(options: {
  open: boolean;
  scope: CommandPaletteScope;
  sessions: unknown[] | null;
  alreadyRequested: boolean;
  sessionsReady?: boolean;
}): boolean {
  if (!options.open || options.sessions !== null || options.sessionsReady || options.alreadyRequested) {
    return false;
  }

  return options.scope === THREADS_COMMAND_PALETTE_SCOPE || options.scope === ALL_COMMAND_PALETTE_SCOPE;
}

export function isCommandPaletteThreadDataLoading(options: {
  sessions: unknown[] | null;
  sessionsLoading: boolean;
  sessionsReady?: boolean;
}): boolean {
  if (options.sessionsReady !== undefined) {
    return !options.sessionsReady;
  }

  return options.sessions === null || (options.sessionsLoading && options.sessions.length === 0);
}

function dedupeCommandPaletteItems<TAction>(items: CommandPaletteItem<TAction>[]): CommandPaletteItem<TAction>[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

export function selectCommandPaletteScopedItems<TAction>(input: {
  scope: CommandPaletteScope;
  query: string;
  openConversationItems: CommandPaletteItem<TAction>[];
  archivedConversationItems: CommandPaletteItem<TAction>[];
  fileItems: CommandPaletteItem<TAction>[];
  searchedConversationItems: CommandPaletteItem<TAction>[];
  searchedFileItems: CommandPaletteItem<TAction>[];
}): CommandPaletteItem<TAction>[] {
  const hasQuery = input.query.trim().length > 0;
  const conversationItems = [
    ...input.openConversationItems,
    ...input.archivedConversationItems,
    ...(hasQuery ? input.searchedConversationItems : []),
  ];
  const fileItems = [...input.fileItems, ...(hasQuery ? input.searchedFileItems : [])];

  switch (input.scope) {
    case ALL_COMMAND_PALETTE_SCOPE:
      return dedupeCommandPaletteItems([...conversationItems, ...fileItems]);
    case THREADS_COMMAND_PALETTE_SCOPE:
      return dedupeCommandPaletteItems(conversationItems);
    default:
      return dedupeCommandPaletteItems(fileItems.filter((item) => item.section === input.scope));
  }
}

const EMPTY_QUERY_LIMITS: Record<string, number> = {
  open: 6,
  commands: 12,
  archived: 8,
};
const DEFAULT_QUICK_OPEN_EMPTY_QUERY_LIMIT = 30;
const MAX_EMPTY_QUERY_LIMIT = 100;
const MAX_QUERY_RESULTS_PER_SECTION = 80;

function readVisibleCommandPaletteSections<TAction>(
  items: CommandPaletteItem<TAction>[],
  scope: CommandPaletteScope,
): CommandPaletteSection[] {
  if (scope === THREADS_COMMAND_PALETTE_SCOPE) {
    return THREAD_COMMAND_PALETTE_SECTIONS;
  }

  if (scope !== ALL_COMMAND_PALETTE_SCOPE) {
    return [scope];
  }

  const sections = new Set<CommandPaletteSection>();
  sections.add('applications');
  sections.add('pages');
  for (const item of items) {
    sections.add(item.section);
  }
  sections.add('open');
  sections.add('commands');
  sections.add('archived');
  return [...sections];
}

function readEmptyQueryLimit(section: CommandPaletteSection, value: number | undefined): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(MAX_EMPTY_QUERY_LIMIT, value)
    : (EMPTY_QUERY_LIMITS[section] ?? DEFAULT_QUICK_OPEN_EMPTY_QUERY_LIMIT);
}

function tokenizeQuery(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function scoreField(token: string, value: string | undefined, weight: number): number | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.toLowerCase();
  const containsIndex = normalizedValue.indexOf(token);
  if (containsIndex !== -1) {
    return weight + Math.max(0, 32 - containsIndex) + Math.max(0, 20 - (normalizedValue.length - token.length));
  }

  const fuzzy = fuzzyScore(token, value);
  if (fuzzy === null) {
    return null;
  }

  return Math.floor(weight / 3) + fuzzy;
}

function scoreCommandPaletteItem<TAction>(item: CommandPaletteItem<TAction>, query: string): number | null {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) {
    return 0;
  }

  let total = 0;
  const keywordFields = item.keywords ?? [];

  for (const token of tokens) {
    let bestTokenScore: number | null = null;

    const titleScore = scoreField(token, item.title, 110);
    if (titleScore !== null) {
      bestTokenScore = Math.max(bestTokenScore ?? titleScore, titleScore);
    }

    const subtitleScore = scoreField(token, item.subtitle, 70);
    if (subtitleScore !== null) {
      bestTokenScore = Math.max(bestTokenScore ?? subtitleScore, subtitleScore);
    }

    const metaScore = scoreField(token, item.meta, 55);
    if (metaScore !== null) {
      bestTokenScore = Math.max(bestTokenScore ?? metaScore, metaScore);
    }

    for (const keyword of keywordFields) {
      const keywordScore = scoreField(token, keyword, 85);
      if (keywordScore !== null) {
        bestTokenScore = Math.max(bestTokenScore ?? keywordScore, keywordScore);
      }
    }

    if (bestTokenScore === null) {
      return null;
    }

    total += bestTokenScore;
  }

  return total;
}

function compareByDefaultOrder<TAction>(left: CommandPaletteItem<TAction>, right: CommandPaletteItem<TAction>): number {
  const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.title.localeCompare(right.title);
}

export function searchCommandPaletteItems<TAction>(
  items: CommandPaletteItem<TAction>[],
  options: {
    query: string;
    scope: CommandPaletteScope;
    scopeSections?: CommandPaletteSection[];
    sectionLabels?: Partial<Record<CommandPaletteSection, string>>;
    /** Set a section to null to show its complete inventory for an empty query. */
    emptyQueryLimits?: Partial<Record<CommandPaletteSection, number | null>>;
  },
): CommandPaletteSectionResult<TAction>[] {
  const query = options.query.trim();
  const emptyQuery = query.length === 0;
  const visibleSections = options.scopeSections ?? readVisibleCommandPaletteSections(items, options.scope);

  return visibleSections.flatMap((section) => {
    const sectionItems = items.filter((item) => item.section === section);
    const rankedItems = sectionItems
      .map((item) => ({ item, score: scoreCommandPaletteItem(item, query) }))
      .filter((entry): entry is { item: CommandPaletteItem<TAction>; score: number } => entry.score !== null)
      .sort((left, right) => {
        if (!emptyQuery && left.score !== right.score) {
          return right.score - left.score;
        }

        return compareByDefaultOrder(left.item, right.item);
      });

    if (rankedItems.length === 0) {
      return [];
    }

    const configuredEmptyQueryLimit = options.emptyQueryLimits?.[section];
    const emptyQueryLimit =
      configuredEmptyQueryLimit === null ? Number.POSITIVE_INFINITY : readEmptyQueryLimit(section, configuredEmptyQueryLimit);
    const limited = emptyQuery ? rankedItems.slice(0, emptyQueryLimit) : rankedItems.slice(0, MAX_QUERY_RESULTS_PER_SECTION);

    return [
      {
        section,
        label: options.sectionLabels?.[section] ?? COMMAND_PALETTE_SECTION_LABELS[section] ?? section,
        total: rankedItems.length,
        items: limited.map(({ item, score }) => ({ ...item, score })),
      } satisfies CommandPaletteSectionResult<TAction>,
    ];
  });
}

export function selectPreferredCommandPaletteCursor<TAction>(
  items: Array<CommandPaletteItem<TAction> & { score?: number }>,
  query: string,
): number {
  if (items.length === 0 || query.trim().length === 0) {
    return 0;
  }

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  items.forEach((item, index) => {
    const score = typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : 0;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}
