import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAppEvents, useLiveTitles } from '../app/contexts';
import { api, type WorkspaceResolvedPathLink } from '../client/api';
import {
  completeConversationOpenPhase,
  ensureConversationOpenStart,
  measureClientPerfTiming,
  recordClientPerfTiming,
} from '../client/perfDiagnostics';
import { buildSlashMenuItems, parseSlashInput, type SlashMenuItem } from '../commands/slashMenu';
import { ComposerAttachmentShelf } from '../components/chat/ComposerAttachmentShelf';
import { detectTranscriptPathCandidates, normalizeTranscriptPathTarget } from '../components/chat/transcriptPathLinks';
import { ConversationApprovalShelf } from '../components/conversation/ConversationApprovalShelf';
import { ConversationComposer } from '../components/conversation/ConversationComposer';
import { ConversationComposerInputControls } from '../components/conversation/ConversationComposerInputControls';
import { MentionMenu, ModelPicker, SlashMenu } from '../components/conversation/ConversationComposerMenus';
import { ConversationComposerMeta } from '../components/conversation/ConversationComposerMeta';
import {
  ConversationDraftEmptyAction,
  DRAFT_EMPTY_STATE_CONTENT_WIDTH_CLASS,
} from '../components/conversation/ConversationDraftEmptyAction';
import { ConversationGoalPanel } from '../components/conversation/ConversationGoalPanel';
import { CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT } from '../components/conversation/conversationQueueCommands';
import { DRAWING_PICKER_OPEN_COMMAND_EVENT } from '../components/conversation/drawingPickerCommands';
import { addNotification } from '../components/notifications/notificationStore';
import {
  AppPageEmptyState,
  CenteredLoadingState,
  EmptyState,
  IconButton,
  LoadingState,
  Notice,
  PageHeader,
  SectionLabel,
  TextButton,
  TextInput,
  ToolbarButton,
} from '../components/ui';
import type { ExcalidrawSceneData } from '../content/excalidrawUtils';
import { parseExcalidrawSceneFromSourceData } from '../content/excalidrawUtils';
import {
  buildBrowserCommentContextMessages,
  buildBrowserCommentsStorageKey,
  isPendingBrowserComment,
  mergeContextMessages,
  normalizePendingBrowserComments,
  type PendingBrowserComment,
  readBrowserChangedContextMessage,
} from '../conversation/browserContextMessages';
import { appendComposerHistory, readComposerHistory } from '../conversation/composerHistory';
import {
  activityDeferredResumes,
  activityExecutions,
  activityQueuedPrompts,
  activityScheduledTasks,
  mergeCanonicalDeferredResumesWithActivity,
} from '../conversation/conversationActivityPresentation';
import { getConversationArtifactIdFromSearch, readArtifactPresentation } from '../conversation/conversationArtifacts';
import { appendIfPresent } from '../conversation/conversationAttachments';
import { parseWholeLineBashCommand } from '../conversation/conversationBashCommand';
import { hasBlockingOverlayOpen } from '../conversation/conversationBlockingOverlay';
import { getConversationCheckpointIdFromSearch } from '../conversation/conversationCheckpoints';
import { shouldHandlePastedComposerFiles } from '../conversation/conversationClipboard';
import {
  isConversationComposerDisabled,
  shouldClearDraftPendingPrompt,
  shouldClearPendingAssistantStatus,
} from '../conversation/conversationComposerDisabled';
import {
  canNavigateComposerHistoryValue,
  resolveComposerClearShortcut,
  resolveComposerHistoryNavigation,
  shouldRestoreFirstQueuedPromptFromComposerShortcut,
  shouldSubmitComposerFromEnter,
} from '../conversation/conversationComposerEditing';
import { shouldShowConversationComposerMeta } from '../conversation/conversationComposerMetaVisibility';
import {
  appendMentionedConversationContextDocs,
  dedupeConversationContextDocs,
  formatConversationComposerPlaceholder,
  removeConversationContextDocByPath,
  resolveConversationAutocompleteCatalogDemand,
  resolveConversationContextUsageTokens,
  resolveConversationGitSummaryPresentation,
  selectUnattachedMentionItems,
} from '../conversation/conversationComposerPresentation';
import { hasConversationComposerShelfContent, splitComposerShelvesByPlacement } from '../conversation/conversationComposerShelves';
import {
  normalizeConversationComposerBehavior,
  resolveConversationComposerSubmitState,
  shouldShowQuestionSubmitAsPrimaryComposerAction,
} from '../conversation/conversationComposerSubmit';
import { formatConversationCwdLabel, hasDraftConversationCwd, isNeutralChatCwdPath } from '../conversation/conversationCwdPresentation';
import {
  nextDragOverStateForDragEnd,
  nextDragOverStateForDragOver,
  readDroppedComposerWorkspacePath,
  shouldHandleDroppedComposerFiles,
} from '../conversation/conversationDragDrop';
import {
  buildBackgroundExecutionIndicatorText,
  buildScheduledTaskIndicatorText,
  isConversationExecutionActive,
  selectConversationScheduledTasks,
} from '../conversation/conversationExecutionActivity';
import { buildComposerShelfContext, buildNewConversationPanelContext } from '../conversation/conversationExtensionContexts';
import { buildMissionAutoModeInputFromDraft, createDraftMissionTask } from '../conversation/conversationGoalMode';
import { formatThinkingLevelLabel } from '../conversation/conversationHeader';
import {
  buildConversationInitialModelPreferenceState,
  consumeConversationInitialPromptAlreadySubmitted,
  hasConversationInitialPromptAlreadySubmitted,
  resolveConversationDraftHydrationState,
  resolveConversationInitialComposerDraftState,
  resolveConversationInitialDeferredResumeState,
  resolveConversationInitialModelPreferenceState,
  resolveConversationInitialPendingPromptState,
} from '../conversation/conversationInitialState';
import { shouldSwitchToWorkbenchForSelectedRun } from '../conversation/conversationLayoutMode';
import {
  shouldFetchConversationAttachmentsNow as resolveShouldFetchConversationAttachmentsNow,
  shouldFetchLiveSessionGitContextNow,
  shouldLoadConversationModelsAfterMetadataReady,
} from '../conversation/conversationLazyLoadDecisions';
import {
  buildConversationLifecycleContext,
  filterConversationLifecycleElements,
  resolveConversationLifecycleEvent,
} from '../conversation/conversationLifecyclePresentation';
import { buildMentionItems, type MentionItem, resolveMentionItems } from '../conversation/conversationMentions';
import { shouldEnableMessageForkControls } from '../conversation/conversationMessageControls';
import {
  pruneComputedMessages,
  resolveComputedMessagesRaw,
  resolveTranscriptWindowPercent,
  shouldShowEarlierTranscriptBoundary,
} from '../conversation/conversationMessageWindow';
import { resolveDraftModelPreferenceUpdate, resolveDraftThinkingPreferenceUpdate } from '../conversation/conversationModelPreferences';
import {
  buildLiveSessionPreferenceInput,
  resolveDraftComposerModelId,
  selectComposerModel,
} from '../conversation/conversationModelSelection';
import {
  hasConversationLoadedHistoricalTailBlocks,
  mergeConversationSessionMeta,
  resolveConversationComposerRunState,
  resolveConversationCwdChangeAction,
  resolveConversationInitialHistoricalWarmupTarget,
  resolveConversationLiveSession,
  resolveConversationPageTitle,
  resolveConversationPendingStatusLabel,
  resolveConversationPerformanceMode,
  resolveConversationStreamTitleSync,
  resolveConversationVisibleScrollBinding,
  resolveDisplayedConversationPendingStatusLabel,
  shouldDeferConversationFileRefresh,
  shouldShowConversationBootstrapLoadingState,
  shouldShowConversationInitialHistoricalWarmupLoader,
  shouldShowConversationInlineLoadingState,
  shouldShowMissingConversationState,
  shouldSubscribeToDesktopConversationState,
  shouldUseHealthyDesktopConversationState,
} from '../conversation/conversationPageState';
import {
  shouldClearAcceptedPendingInitialPrompt,
  shouldClearStalePendingInitialPrompt,
  shouldResetPendingInitialPromptFailureSession,
} from '../conversation/conversationPendingInitialPrompt';
import {
  resolveSelectedModelNotice,
  shouldClearComposerForModelSelection,
  shouldEnsureControlForPreferenceSave,
  shouldSkipModelPreferenceSave,
  shouldSkipThinkingPreferenceSave,
} from '../conversation/conversationPreferenceSaving';
import {
  buildComposerQuestionAnswersStorageKey,
  EMPTY_ASK_USER_ANSWERS,
  hasAskUserQuestionAnswers,
} from '../conversation/conversationQuestionAnswers';
import { insertReplyQuoteIntoComposer } from '../conversation/conversationReplyQuote';
import { didConversationStopMidTurn, didConversationStopWithError, getConversationResumeState } from '../conversation/conversationResume';
import { readConversationIdFromPathname } from '../conversation/conversationRoutes';
import { shouldLoadConversationRun as resolveShouldLoadConversationRun } from '../conversation/conversationRunLoading';
import { createConversationLiveRunId, getConversationRunIdFromSearch } from '../conversation/conversationRuns';
import { shouldRefetchSavedWorkspacePaths, syncSavedWorkspacePathValues } from '../conversation/conversationSavedWorkspaces';
import {
  getConversationInitialScrollKey,
  getConversationTailBlockKey,
  shouldShowScrollToBottomControl,
} from '../conversation/conversationScroll';
import {
  formatConversationLocalActionFailure,
  formatConversationMessageActionFailure,
  isConversationSessionNotLiveError,
  primeCreatedConversationOpenCaches,
  retryConversationActionAfterNotLive,
} from '../conversation/conversationSessionLifecycle';
import {
  type ConversationSlashCommand,
  parseConversationSlashCommand,
  resolveConversationSlashCommandExecution,
} from '../conversation/conversationSlashCommand';
import { buildSuggestedContextShelfState } from '../conversation/conversationSuggestedContextShelf';
import { NEW_CONVERSATION_TITLE } from '../conversation/conversationTitle';
import {
  INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS,
  resolveNextConversationTranscriptTailBlocks,
  shouldResetConversationTranscriptTailBlocksForLiveTransition,
} from '../conversation/conversationTranscriptPaging';
import { buildOpenArtifactSearch, buildOpenKnowledgeFileSearch } from '../conversation/conversationWorkbenchNavigation';
import {
  buildAvailableDraftWorkspacePaths,
  buildWorkspacePickerPaths,
  resolveConversationCurrentCwd,
} from '../conversation/conversationWorkspaceState';
import {
  beginDraftConversationAttachmentsMutation,
  buildDraftConversationComposerStorageKey,
  clearConversationAttachments,
  clearDraftConversationAttachments,
  clearDraftConversationComposer,
  clearDraftConversationContextDocs,
  clearDraftConversationCwd,
  clearDraftConversationModel,
  clearDraftConversationModelPreferences,
  clearDraftConversationThinkingLevel,
  DRAFT_CONVERSATION_STATE_CHANGED_EVENT,
  isDraftConversationAttachmentsMutationCurrent,
  persistConversationAttachments,
  persistDraftConversationAttachments,
  persistDraftConversationComposer,
  persistDraftConversationContextDocs,
  persistDraftConversationCwd,
  persistDraftConversationModel,
  persistDraftConversationThinkingLevel,
  readConversationAttachments,
  readDraftConversationAttachments,
  readDraftConversationContextDocs,
  readDraftConversationCwd,
  readDraftConversationModel,
  readDraftConversationThinkingLevel,
} from '../conversation/draftConversation';
import {
  resolveReservedDraftConversationCreateCwd,
  startReservedDraftConversationLiveSessionCreate,
} from '../conversation/draftConversationCreateFlow';
import {
  type ExtensionSlashCommandResult,
  findExtensionSlashCommand as findExtensionSlashCommandMatch,
  resolveExtensionSlashCommandResult,
} from '../conversation/extensionSlashCommands';
import {
  buildConversationComposerStorageKey,
  persistForkPromptDraft,
  resolveBranchEntryIdFromSessionDetailResult,
  resolveRewindTargetForMessage,
  resolveRewindTargetFromResolvedEntry,
  resolveSessionEntryIdFromBlockId,
} from '../conversation/forking';
import {
  normalizePendingRelatedConversationIds,
  shouldAutoDispatchPendingInitialPrompt,
  shouldClaimPendingInitialPromptForSession,
  shouldKeepStoredPendingInitialPromptDuringDispatch,
} from '../conversation/pendingInitialPromptLogic';
import {
  buildComposerFilePreparationNotices,
  buildPromptImages,
  type ComposerDrawingAttachment,
  type ComposerImageAttachment,
  createComposerDrawingLocalId,
  drawingAttachmentToPromptImage,
  drawingAttachmentToPromptRef,
  prepareComposerFiles,
  readComposerTransferFiles,
  removeComposerDrawingAttachmentByLocalId,
  removeComposerImageFileAtIndex,
  restoreComposerImageFiles,
  restoreQueuedImageFiles,
} from '../conversation/promptAttachments';
import { selectDraftRelatedThreadCandidates } from '../conversation/relatedConversationCandidates';
import type { RelatedConversationSearchResult } from '../conversation/relatedConversationSearch';
import {
  pruneRelatedThreadSelectionIds,
  resolveRelatedThreadPreselectionUpdate,
  selectMissingRelatedThreadSearchIndexIds,
  selectMissingRelatedThreadSummaryIds,
  toggleRelatedThreadSelectionIds,
} from '../conversation/relatedThreadSelection';
import { collectCompletedToolAutoOpenBlockKeys, findRequestedToolPresentationToOpen } from '../conversation/toolAutoOpen';
import { useComposerController } from '../conversation/useComposerController';
import { useConversationComposerMenus, type UseConversationComposerMenusState } from '../conversation/useConversationComposerMenus';
import { useComposerModifierKeys, useVisualViewportKeyboardInset } from '../conversation/useConversationKeyboardState';
import { useConversationModels } from '../conversation/useConversationModels';
import { useDesktopConversationShortcuts } from '../conversation/useDesktopConversationShortcuts';
import { hasBlockingConversationOverlay, useEscapeAbortStream } from '../conversation/useEscapeAbortStream';
import { useInitialDraftAttachmentHydration } from '../conversation/useInitialDraftAttachmentHydration';
import { MAX_RELATED_THREAD_HOTKEYS, useRelatedThreadHotkeys } from '../conversation/useRelatedThreadHotkeys';
import { useWorkspaceComposerEvents } from '../conversation/useWorkspaceComposerEvents';
import { shouldAutoResumeDeferredResumes } from '../deferred-resume/deferredResumeAutoResume';
import {
  buildDeferredResumeScheduleTimerKey,
  buildOverdueScheduledDeferredResumeRefreshKey,
  describeDeferredResumeStatus,
  resolveDeferredResumePresentationState,
} from '../deferred-resume/deferredResumeIndicator';
import { parseDeferredResumeSlashCommand } from '../deferred-resume/deferredResumeSlashCommand';
import { writeClipboardText } from '../desktop/clipboard';
import { DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT, getDesktopBridge } from '../desktop/desktopBridge';
import { setExtensionCommandContext } from '../extensions/commands';
import { ComposerShelfHost } from '../extensions/ComposerShelfHost';
import { ConversationHeaderHost } from '../extensions/ConversationHeaderHost';
import { ConversationLifecycleHost } from '../extensions/ConversationLifecycleHost';
import { buildExtensionMentionItems } from '../extensions/extensionMentions';
import { createNativeExtensionClient } from '../extensions/nativePaClient';
import { NewConversationPanelHost } from '../extensions/NewConversationPanelHost';
import type { ExtensionMentionRegistration, ExtensionSlashCommandRegistration } from '../extensions/types';
import { useExtensionBackendConfirmations } from '../extensions/useExtensionBackendConfirmations';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import {
  INITIAL_STREAM_STATE,
  resolveControllableConversationSurfaceId,
  retryLiveSessionActionAfterTakeover,
} from '../hooks/sessionStream';
import { useConversationEventVersion } from '../hooks/useConversationEventVersion';
import { useConversationScroll } from '../hooks/useConversationScroll';
import {
  notifyDesktopConversationStateRefresh,
  primeReservedDesktopConversationStateCache,
  useDesktopConversationState,
} from '../hooks/useDesktopConversationState';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import { primeSessionDetailCache, useSessionDetail } from '../hooks/useSessions';
import { useReloadState } from '../local/reloadState';
import { normalizeWorkspacePaths, readStoredWorkspacePaths, writeStoredWorkspacePaths } from '../local/savedWorkspacePaths';
import { hasSelectableModelId, resolveSelectableModelId } from '../model/modelPreferences';
import {
  clearPendingConversationPrompt,
  consumePendingConversationPrompt,
  isPendingConversationPromptDispatching,
  PENDING_CONVERSATION_PROMPT_CHANGED_EVENT,
  type PendingConversationPrompt,
  type PendingConversationPromptChangedDetail,
  persistPendingConversationPrompt,
  readPendingConversationPrompt,
  setPendingConversationPromptDispatching,
} from '../pending/pendingConversationPrompt';
import {
  appendPendingInitialPromptBlock,
  buildConversationPendingQueueItems,
  mergeLiveAndActivityPendingQueueItems,
  resolveRestoredQueuedPromptComposerUpdate,
} from '../pending/pendingQueueMessages';
import {
  closeConversationTab,
  ensureConversationTabOpen,
  fetchRemoteConversationLayout,
  forgetConversationTab,
  setActiveConversationTab,
} from '../session/sessionTabs';
import type {
  ConversationAttachmentSummary,
  ConversationContextDocRef,
  DeferredResumeSummary,
  DurableRunRecord,
  LiveSessionContext,
  LiveSessionForkResult,
  LiveSessionToolDefinition,
  MemoryData,
  MessageBlock,
  PromptAttachmentRefInput,
  SessionMeta,
  WorkspaceEntry,
} from '../shared/types';
import type { ConversationSummaryRecord } from '../shared/types';
import {
  conversationRuntimeStore,
  runStore,
  sessionStore,
  taskStore,
  titleStore,
  useAllRuns,
  useAllSessions,
  useAllTasks,
  useConversationRuntime,
  useSession,
  useSessionsReady,
} from '../store';
import {
  type AskUserQuestionAnswers,
  type AskUserQuestionPresentation,
  buildAskUserQuestionReplyText,
  buildPendingAskUserQuestionKey,
  countAnsweredAskUserQuestions,
  findPendingAskUserQuestion,
  isAskUserQuestionComplete,
  moveAskUserQuestionIndex,
  resolveAskUserQuestionAnswerSelection,
  resolveAskUserQuestionDefaultOptionIndex,
  resolveAskUserQuestionOptionHotkey,
  shouldAdvanceAskUserQuestionAfterSelection,
} from '../transcript/askUserQuestions';
import {
  addHydratingHistoricalBlockId,
  buildHydratingHistoricalBlockIdSet,
  displayBlockToMessageBlock,
  hydrateTranscriptRenderItems,
  mergeHistoricalAndStreamBlocks,
  mergeHydratedHistoricalBlocks,
  mergeHydratedStreamBlocks,
  normalizeHistoricalBlockId,
  parseDeferredEntryHydrationId,
  removeHydratingHistoricalBlockId,
  transcriptRenderItemsToMessageBlocks,
} from '../transcript/messageBlocks';
import { APP_LAYOUT_MODE_CHANGED_EVENT, type AppLayoutMode, readAppLayoutMode, writeAppLayoutMode } from '../ui-state/appLayoutMode';

export {
  replaceConversationMetaInSessionList,
  resolveConversationComposerRunState,
  resolveConversationCwdChangeAction,
  resolveConversationPerformanceMode,
  resolveDisplayedConversationPendingStatusLabel,
  shouldDeferConversationFileRefresh,
  shouldFetchConversationAttachments,
  shouldFetchConversationLiveSessionGitContext,
  shouldLoadConversationModels,
  shouldShowMissingConversationState,
  shouldUseHealthyDesktopConversationState,
} from '../conversation/conversationPageState';
export {
  hasConversationTranscriptAcceptedPendingInitialPrompt,
  shouldAutoDispatchPendingInitialPrompt,
} from '../conversation/pendingInitialPromptLogic';
const ConversationArtifactModal = lazy(() =>
  import('../components/ConversationArtifactModal').then((module) => ({ default: module.ConversationArtifactModal })),
);

const ConversationDrawingsPickerModal = lazy(() =>
  import('../components/ConversationDrawingsPickerModal').then((module) => ({ default: module.ConversationDrawingsPickerModal })),
);
const loadChatView = () => import('../components/chat/ChatView').then((module) => ({ default: module.ChatView }));
const ChatView = lazy(loadChatView);
const EMPTY_TOOL_DEFINITIONS: LiveSessionToolDefinition[] = [];

function formatConversationCwdError(error: unknown): string {
  const fallback = 'Could not change the working directory.';
  if (!(error instanceof Error)) {
    return fallback;
  }

  let message = error.message.trim();
  if (!message) {
    return fallback;
  }

  const apiPreviewMatch = /^(?:400|500) [^:]+ from \/api\/conversations\/[^/]+\/cwd:\s*(.+)$/i.exec(message);
  if (apiPreviewMatch?.[1]?.trim()) {
    message = apiPreviewMatch[1].trim();
  }

  const missingDirectoryMatch = /^Directory does not exist:\s*(.+)$/i.exec(message);
  if (missingDirectoryMatch?.[1]?.trim()) {
    return `Choose an existing folder. ${missingDirectoryMatch[1].trim()} could not be found.`;
  }

  const notDirectoryMatch = /^Not a directory:\s*(.+)$/i.exec(message);
  if (notDirectoryMatch?.[1]?.trim()) {
    return `Choose a folder, not a file. ${notDirectoryMatch[1].trim()} is not a folder.`;
  }

  return message;
}

const ConversationActivityShelf = lazy(() =>
  import('../components/conversation/ConversationActivityShelf').then((module) => ({ default: module.ConversationActivityShelf })),
);
const ConversationContextShelf = lazy(() =>
  import('../components/conversation/ConversationContextShelf').then((module) => ({ default: module.ConversationContextShelf })),
);
const ConversationQuestionShelf = lazy(() =>
  import('../components/conversation/ConversationQuestionShelf').then((module) => ({ default: module.ConversationQuestionShelf })),
);
const ConversationQueueShelf = lazy(() =>
  import('../components/conversation/ConversationQueueShelf').then((module) => ({ default: module.ConversationQueueShelf })),
);
const ConversationSavedHeader = lazy(() =>
  import('../components/ConversationSavedHeader').then((module) => ({ default: module.ConversationSavedHeader })),
);

interface ExcalidrawEditorSavePayload {
  localId?: string;
  attachmentId?: string;
  revision?: number;
  dirty?: boolean;
  title: string;
  scene: ExcalidrawSceneData;
  sourceData: string;
  sourceMimeType: string;
  sourceName: string;
  previewData: string;
  previewMimeType: string;
  previewName: string;
  previewUrl: string;
}

const INITIAL_HISTORICAL_TAIL_BLOCKS = INITIAL_CONVERSATION_TRANSCRIPT_TAIL_BLOCKS;
const HISTORICAL_TAIL_BLOCKS_STEP = 40;
const HISTORICAL_TAIL_BLOCKS_STEP_PERCENT = 10;
const MAX_RELATED_THREAD_SELECTIONS = 5;
const MAX_VISIBLE_RELATED_THREAD_RESULTS = 10;
const RELATED_THREAD_RECENT_WINDOW_DAYS = 3;
const MAX_RELATED_THREAD_CANDIDATES = 24;

const MAX_RENDERED_BLOCKS = 300;
const HISTORICAL_PREFETCH_SCROLL_THRESHOLD_PX = 700;
const HISTORICAL_PREFETCH_COOLDOWN_MS = 800;
const WORKBENCH_BROWSER_COMMENT_ADDED_EVENT = 'pa:workbench-browser-comment-added';
const WORKBENCH_OPEN_WORKSPACE_FILE_EVENT = 'pa:workbench-open-workspace-file';
const TRANSCRIPT_PATH_LINK_TARGET_SETTING_KEY = 'systemFiles.transcriptPathLinkTarget';
const MAX_TRANSCRIPT_PATH_LINK_TARGETS = 400;
const WORKSPACE_MENTION_MAX_ENTRIES = 200;
const WORKSPACE_MENTION_MAX_DIRECTORIES = 24;
const WORKSPACE_MENTION_SKIP_DIRECTORIES = new Set(['.git', 'node_modules', 'dist']);

async function loadWorkspaceMentionEntries(cwd: string): Promise<WorkspaceEntry[]> {
  const entries: WorkspaceEntry[] = [];
  const queue = [''];
  let visitedDirectories = 0;

  while (queue.length > 0 && entries.length < WORKSPACE_MENTION_MAX_ENTRIES && visitedDirectories < WORKSPACE_MENTION_MAX_DIRECTORIES) {
    const path = queue.shift() ?? '';
    visitedDirectories += 1;
    const listing = await api.workspaceTree(cwd, path);

    for (const entry of listing.entries) {
      if (entry.kind !== 'file' && entry.kind !== 'directory') {
        continue;
      }

      entries.push(entry);
      if (entries.length >= WORKSPACE_MENTION_MAX_ENTRIES) {
        break;
      }

      if (
        entry.kind === 'directory' &&
        !WORKSPACE_MENTION_SKIP_DIRECTORIES.has(entry.name) &&
        queue.length < WORKSPACE_MENTION_MAX_DIRECTORIES
      ) {
        queue.push(entry.path);
      }
    }
  }

  return entries;
}

type TranscriptPathLinkTarget = 'fileExplorer' | 'desktop';

function normalizeTranscriptPathLinkTargetSetting(value: unknown): TranscriptPathLinkTarget {
  return value === 'desktop' ? 'desktop' : 'fileExplorer';
}

function collectTranscriptPathCandidateTargetsFromValue(value: unknown, targets: Set<string>, depth = 0): void {
  if (targets.size >= MAX_TRANSCRIPT_PATH_LINK_TARGETS || depth > 5 || value == null) {
    return;
  }

  if (typeof value === 'string') {
    for (const candidate of detectTranscriptPathCandidates(value)) {
      targets.add(candidate.targetPath);
      if (targets.size >= MAX_TRANSCRIPT_PATH_LINK_TARGETS) {
        break;
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTranscriptPathCandidateTargetsFromValue(item, targets, depth + 1);
      if (targets.size >= MAX_TRANSCRIPT_PATH_LINK_TARGETS) {
        break;
      }
    }
    return;
  }

  if (typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectTranscriptPathCandidateTargetsFromValue(item, targets, depth + 1);
      if (targets.size >= MAX_TRANSCRIPT_PATH_LINK_TARGETS) {
        break;
      }
    }
  }
}

function collectTranscriptPathCandidateTargets(messages: MessageBlock[] | undefined): string[] {
  if (!messages?.length) {
    return [];
  }

  const targets = new Set<string>();
  for (const message of messages) {
    collectTranscriptPathCandidateTargetsFromValue(message, targets);
    if (targets.size >= MAX_TRANSCRIPT_PATH_LINK_TARGETS) {
      break;
    }
  }

  return Array.from(targets).sort();
}

function findLastAssistantMessageText(messages: MessageBlock[] | undefined): string | null {
  if (!messages?.length) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.type !== 'text') {
      continue;
    }

    const text = message.text.trim();
    if (text) {
      return text;
    }
  }

  return null;
}

const EMPTY_PENDING_BROWSER_COMMENTS: PendingBrowserComment[] = [];

export { shouldEnableMessageForkControls };

// ── ConversationPage ──────────────────────────────────────────────────────────

export { buildMissionAutoModeInputFromDraft, createDraftMissionTask };

export function shouldMountComposerShelvesImmediately(input: {
  draft: boolean;
  composerChromeReady: boolean;
  showConversationLoadingState: boolean;
}): boolean {
  if (input.draft) return true;
  return input.composerChromeReady && !input.showConversationLoadingState;
}

export function shouldPrepareConversationComposerChrome(input: {
  draft: boolean;
  conversationId: string | null | undefined;
  composerChromeReady: boolean;
  showConversationLoadingState: boolean;
}): boolean {
  if (input.draft) return false;
  return Boolean(input.conversationId) && !input.composerChromeReady && !input.showConversationLoadingState;
}

export function shouldShowNewConversationSetup(input: {
  draft: boolean;
  hasRenderableMessages: boolean;
  showConversationLoadingState: boolean;
  hasSessionError: boolean;
}): boolean {
  if (input.draft) return true;
  return !input.hasRenderableMessages && !input.showConversationLoadingState && !input.hasSessionError;
}

export function shouldReleaseWholeLineBashLock(input: { messages: MessageBlock[] | undefined; command: string | null }): boolean {
  if (!input.command || !input.messages?.length) {
    return false;
  }

  return input.messages.some((message) => {
    if (message.type !== 'tool_use' || message.tool !== 'bash') {
      return false;
    }
    if (message.input?.command !== input.command) {
      return false;
    }
    if (message.status === 'running' || message.running === true) {
      return false;
    }
    return message.status === 'ok' || message.status === 'error' || message.durationMs !== undefined || message.details !== undefined;
  });
}

export async function cancelConversationGoalViaApi(input: {
  conversationId: string | null | undefined;
  updateGoal: (conversationId: string, payload: { objective?: string }) => Promise<unknown>;
  refreshConversation: () => Promise<unknown>;
  showNotice: (tone: 'accent' | 'danger', text: string, durationMs?: number) => void;
}): Promise<void> {
  if (!input.conversationId) {
    input.showNotice('danger', 'Open a conversation before cancelling a goal.', 4000);
    return;
  }

  try {
    await input.updateGoal(input.conversationId, {});
    await input.refreshConversation().catch(() => {});
    input.showNotice('accent', 'Goal cancelled.');
  } catch (error) {
    input.showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
  }
}

type DeferredResumeOperation = 'schedule' | 'fire' | 'cancel' | 'continue';

function hasInternalDeferredResumeFailureDetails(message: string): boolean {
  return (
    /Local API route did not complete/i.test(message) ||
    /\/api\//i.test(message) ||
    /file:\/\//i.test(message) ||
    /\bENOENT\b|\bEACCES\b|\bENOTDIR\b|permission denied|no such file or directory/i.test(message) ||
    /\s+at\s+\S+/i.test(message) ||
    /\bModule\.[A-Za-z_$][\w$]*/.test(message) ||
    /packages\/desktop\//i.test(message)
  );
}

export function formatDeferredResumeOperationFailure(operation: DeferredResumeOperation, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const trimmed = message.trim();
  if (trimmed && !hasInternalDeferredResumeFailureDetails(trimmed)) {
    return trimmed;
  }

  switch (operation) {
    case 'schedule':
      return 'Could not schedule the wakeup. Check the delay and try again.';
    case 'fire':
      return 'Could not start this wakeup. Refresh the conversation and try again.';
    case 'cancel':
      return 'Could not cancel this wakeup. Refresh the conversation and try again.';
    case 'continue':
      return 'Could not resume deferred work. Refresh the conversation and try again.';
  }
}

export async function loadDeferredResumesAfterConversationRefresh(input: {
  refreshConversation: () => Promise<unknown>;
  loadDeferredResumes: () => Promise<{ resumes: DeferredResumeSummary[] }>;
}): Promise<DeferredResumeSummary[]> {
  await input.refreshConversation().catch(() => {});
  const data = await input.loadDeferredResumes();
  return data.resumes;
}

export type ComposerQuestionHotkeyAction =
  | { kind: 'none' }
  | { kind: 'moveOption'; direction: -1 | 1 }
  | { kind: 'selectOption'; optionIndex: number }
  | { kind: 'moveQuestion'; direction: -1 | 1 }
  | { kind: 'submitOrSelect' };

export function resolveComposerQuestionHotkeyAction(input: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  hasPendingQuestion: boolean;
  questionSubmitting: boolean;
  composerInputLength: number;
  attachmentCount: number;
  drawingAttachmentCount: number;
  activeOptionCount: number;
}): ComposerQuestionHotkeyAction {
  if (
    !input.hasPendingQuestion ||
    input.questionSubmitting ||
    input.composerInputLength > 0 ||
    input.attachmentCount > 0 ||
    input.drawingAttachmentCount > 0 ||
    input.ctrlKey ||
    input.metaKey ||
    input.altKey ||
    input.isComposing
  ) {
    return { kind: 'none' };
  }

  if (input.key === 'ArrowDown' && !input.shiftKey && input.activeOptionCount > 0) {
    return { kind: 'moveOption', direction: 1 };
  }

  if (input.key === 'ArrowUp' && !input.shiftKey && input.activeOptionCount > 0) {
    return { kind: 'moveOption', direction: -1 };
  }

  const optionHotkeyIndex = resolveAskUserQuestionOptionHotkey(input.key);
  if (optionHotkeyIndex >= 0 && optionHotkeyIndex < input.activeOptionCount) {
    return { kind: 'selectOption', optionIndex: optionHotkeyIndex };
  }

  if (input.key === 'Tab') {
    return { kind: 'moveQuestion', direction: input.shiftKey ? -1 : 1 };
  }

  if (!input.shiftKey && input.key === 'ArrowRight') {
    return { kind: 'moveQuestion', direction: 1 };
  }

  if (!input.shiftKey && input.key === 'ArrowLeft') {
    return { kind: 'moveQuestion', direction: -1 };
  }

  if ((input.key === 'Enter' || input.key === ' ') && !input.shiftKey) {
    return { kind: 'submitOrSelect' };
  }

  return { kind: 'none' };
}

export function ConversationPage({ draft = false, conversationId }: { draft?: boolean; conversationId?: string | null }) {
  const { id: routeId } = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const routeConversationId = useMemo(() => readConversationIdFromPathname(location.pathname), [location.pathname]);
  const invalidConversationRoute = !draft && !conversationId && Boolean(routeId) && routeConversationId === null;
  const id = draft ? undefined : (conversationId ?? routeConversationId ?? undefined);
  const selectedArtifactId = getConversationArtifactIdFromSearch(location.search);
  const selectedCheckpointId = getConversationCheckpointIdFromSearch(location.search);
  const selectedRunId = getConversationRunIdFromSearch(location.search);
  const previousSelectedRunIdRef = useRef<string | null | undefined>(undefined);
  const [appLayoutMode, setAppLayoutMode] = useState<AppLayoutMode>(() => readAppLayoutMode());
  const artifactOpensInWorkbenchPane = appLayoutMode === 'workbench';
  const { versions } = useAppEvents();
  const sessions = useAllSessions();
  const tasks = useAllTasks();
  const runRecords = useAllRuns();
  const sessionsReady = useSessionsReady();
  const [remoteControlledConversationIds, setRemoteControlledConversationIds] = useState<string[]>([]);
  const conversationEventVersion = useConversationEventVersion(id);
  useEffect(() => {
    if (invalidConversationRoute) {
      navigate('/conversations/new', { replace: true });
    }
  }, [invalidConversationRoute, navigate]);
  useEffect(() => {
    const preload = () => void loadChatView();
    const timeoutId = window.setTimeout(preload, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);
  useEffect(() => {
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void fetchRemoteConversationLayout({
        refresh: false,
        reason: 'ConversationPage.remoteControlledIds',
      })
        .then((layout) => {
          if (!cancelled) setRemoteControlledConversationIds(layout.remoteControlledConversationIds ?? []);
        })
        .catch(() => {
          if (!cancelled) setRemoteControlledConversationIds([]);
        });
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [versions.sessions]);

  const openArtifact = useCallback(
    (artifactId: string) => {
      if (selectedArtifactId === artifactId) {
        return;
      }

      const nextSearch = buildOpenArtifactSearch(location.search, artifactId);
      window.dispatchEvent(new CustomEvent('pa:workbench-open-artifact-tab', { detail: { artifactId } }));

      navigate({
        pathname: location.pathname,
        search: nextSearch,
      });
    },
    [location.pathname, location.search, navigate, selectedArtifactId],
  );

  const openCheckpoint = useCallback(() => undefined, []);

  const openRun = useCallback((runId: string) => {
    window.dispatchEvent(new CustomEvent('pa:focus-background-run', { detail: { runId } }));
  }, []);

  const openScheduledTask = useCallback(
    (taskId: string) => {
      navigate(`/automations/${encodeURIComponent(taskId)}`);
    },
    [navigate],
  );

  const openWorkbenchBrowser = useCallback(() => {
    window.dispatchEvent(new CustomEvent(DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT));
  }, []);

  const openKnowledgeFilePath = useCallback(
    (fileId: string) => {
      const normalizedFileId = fileId.trim();
      if (!normalizedFileId) {
        return;
      }

      setAppLayoutMode('workbench');
      writeAppLayoutMode('workbench');

      const nextSearch = buildOpenKnowledgeFileSearch(location.search, normalizedFileId);
      if (nextSearch === null) {
        return;
      }

      navigate({
        pathname: location.pathname,
        search: nextSearch,
      });
    },
    [location.pathname, location.search, navigate],
  );

  useEffect(() => {
    function handleAppLayoutModeChanged() {
      setAppLayoutMode(readAppLayoutMode());
    }

    window.addEventListener(APP_LAYOUT_MODE_CHANGED_EVENT, handleAppLayoutModeChanged);
    window.addEventListener('storage', handleAppLayoutModeChanged);
    return () => {
      window.removeEventListener(APP_LAYOUT_MODE_CHANGED_EVENT, handleAppLayoutModeChanged);
      window.removeEventListener('storage', handleAppLayoutModeChanged);
    };
  }, []);

  useEffect(() => {
    const previousSelectedRunId = previousSelectedRunIdRef.current;
    previousSelectedRunIdRef.current = selectedRunId;

    if (!shouldSwitchToWorkbenchForSelectedRun({ selectedRunId, previousSelectedRunId, appLayoutMode })) {
      return;
    }

    setAppLayoutMode('workbench');
    writeAppLayoutMode('workbench');
  }, [appLayoutMode, selectedRunId]);

  // ── Live session detection ─────────────────────────────────────────────────
  const sessionSnapshot = useSession(id);
  const conversationRuntime = useConversationRuntime(id);
  const conversationRuntimeIsRunning = conversationRuntime?.running ?? sessionSnapshot?.isRunning;
  const sessionsLoaded = sessionsReady;
  // We use a confirmed-live flag only for lightweight session-state labeling.
  const [confirmedLive, setConfirmedLive] = useState<boolean | null>(null);
  const [liveSessionHasStaleTurnState, setLiveSessionHasStaleTurnState] = useState(false);
  const [recoveredLiveSessionIsRunning, setRecoveredLiveSessionIsRunning] = useState<boolean | null>(null);
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<PendingConversationPrompt | null>(() =>
    resolveConversationInitialPendingPromptState({ draft, conversationId: id, locationState: location.state }),
  );
  const [pendingInitialPromptDispatching, setPendingInitialPromptDispatchingState] = useState(() =>
    draft || !id ? false : isPendingConversationPromptDispatching(id),
  );
  const [draftPendingPrompt, setDraftPendingPrompt] = useState<PendingConversationPrompt | null>(null);
  const pendingInitialPromptSessionIdRef = useRef<string | null>(null);
  const pendingInitialPromptFailureSessionIdRef = useRef<string | null>(null);
  const pinnedInitialPromptScrollSessionIdRef = useRef<string | null>(null);
  const pinnedInitialPromptTailKeyRef = useRef<string | null>(null);
  const deferredConversationFileVersionRef = useRef<{ conversationId: string; version: number } | null>(null);
  const handledCwdChangeKeyRef = useRef<string | null>(null);

  const hasPendingInitialPromptInFlight = Boolean(id) && pendingInitialPromptSessionIdRef.current === id;
  const deferConversationFileRefresh = shouldDeferConversationFileRefresh({
    draft,
    conversationId: id,
    hasPendingInitialPrompt: Boolean(pendingInitialPrompt),
    pendingInitialPromptDispatching,
    hasPendingInitialPromptInFlight,
  });
  const deferredConversationFileVersion = deferredConversationFileVersionRef.current;
  const effectiveConversationEventVersion =
    deferConversationFileRefresh && deferredConversationFileVersion !== null && deferredConversationFileVersion.conversationId === id
      ? deferredConversationFileVersion.version
      : conversationEventVersion;

  const [historicalTailBlocks, setHistoricalTailBlocks] = useState(INITIAL_HISTORICAL_TAIL_BLOCKS);
  const [initialHistoricalWarmupConversationId, setInitialHistoricalWarmupConversationId] = useState<string | null>(null);
  const [autoAnchorTranscriptTail, setAutoAnchorTranscriptTail] = useState(true);
  const previousConversationLiveDecisionRef = useRef<{
    conversationId: string | null;
    isLive: boolean | null;
  }>({ conversationId: null, isLive: null });
  const desktopConversation = useDesktopConversationState(id ?? null, {
    tailBlocks: historicalTailBlocks,
    includeToolBlocks: false,
    version: effectiveConversationEventVersion,
    enabled: shouldSubscribeToDesktopConversationState({ draft }),
  });
  const desktopConversationChecking = false;
  const useDesktopConversation = shouldUseHealthyDesktopConversationState({
    draft,
    conversationId: id,
    desktopMode: desktopConversation.mode,
    desktopError: desktopConversation.error,
  });
  const visibleDesktopConversationState =
    useDesktopConversation && id && desktopConversation.state?.conversationId === id ? desktopConversation.state : null;
  const visibleDesktopSessionDetail = visibleDesktopConversationState?.sessionDetail ?? null;
  const desktopSessionDetailNeedsRequestedTail =
    visibleDesktopSessionDetail !== null && !hasConversationLoadedHistoricalTailBlocks(visibleDesktopSessionDetail, historicalTailBlocks);
  const shouldFetchSavedDesktopSessionDetailFallback =
    useDesktopConversation &&
    Boolean(id) &&
    visibleDesktopConversationState?.liveSession?.live === false &&
    !visibleDesktopSessionDetail &&
    visibleDesktopConversationState.stream.hasSnapshot === false &&
    visibleDesktopConversationState.stream.blocks.length === 0;
  const conversationVersionKey = `${effectiveConversationEventVersion}`;
  const webConversationBootstrap = null;
  const webConversationBootstrapLoading = false;
  const desktopConversationBootstrap =
    id && visibleDesktopConversationState
      ? {
          conversationId: id,
          sessionDetail: visibleDesktopSessionDetail,
          liveSession: visibleDesktopConversationState.liveSession ?? { live: false as const },
        }
      : null;
  const webVisibleConversationBootstrap = id && webConversationBootstrap?.conversationId === id ? webConversationBootstrap : null;
  const webBootstrapSatisfiesRequestedTail = hasConversationLoadedHistoricalTailBlocks(
    webVisibleConversationBootstrap?.sessionDetail,
    historicalTailBlocks,
  );
  const shouldUseWebBootstrapForDesktopTail = desktopSessionDetailNeedsRequestedTail && webBootstrapSatisfiesRequestedTail;
  const visibleConversationBootstrap = useDesktopConversation
    ? shouldUseWebBootstrapForDesktopTail
      ? (webVisibleConversationBootstrap ?? desktopConversationBootstrap)
      : (desktopConversationBootstrap ?? webVisibleConversationBootstrap)
    : webVisibleConversationBootstrap;
  const bootstrapSessionDetail =
    id && visibleConversationBootstrap?.sessionDetail?.meta.id === id ? visibleConversationBootstrap.sessionDetail : null;
  const conversationBootstrapLoading = useDesktopConversation
    ? desktopConversation.loading && !visibleConversationBootstrap
      ? webConversationBootstrapLoading
      : false
    : desktopConversationChecking
      ? true
      : webConversationBootstrapLoading;
  const primeForkedConversationOpenCaches = useCallback(
    (forked: LiveSessionForkResult) => {
      if (!forked.bootstrap) {
        return;
      }

      primeCreatedConversationOpenCaches(
        {
          id: forked.newSessionId,
          sessionFile: forked.sessionFile,
          bootstrap: forked.bootstrap,
        },
        {
          tailBlocks: historicalTailBlocks,
          bootstrapVersionKey: conversationVersionKey,
          sessionDetailVersion: conversationEventVersion,
        },
      );
      const seedForkedSessionMeta = (sessionMeta: SessionMeta) => {
        sessionStore.upsert(sessionMeta);
      };
      const forkedSessionMeta = forked.bootstrap.sessionDetail?.meta;
      if (forkedSessionMeta) {
        seedForkedSessionMeta(forkedSessionMeta);
      } else if (forked.bootstrap.liveSession?.live) {
        const liveSession = forked.bootstrap.liveSession;
        const now = new Date().toISOString();
        const optimisticMeta: SessionMeta = {
          id: forked.newSessionId,
          file: forked.sessionFile,
          timestamp: now,
          cwd: liveSession.cwd,
          cwdSlug: '',
          model: '',
          title: liveSession.title ?? NEW_CONVERSATION_TITLE,
          messageCount: 0,
          isRunning: liveSession.isStreaming,
          isLive: true,
        };
        seedForkedSessionMeta(optimisticMeta);
      }
    },
    [conversationEventVersion, conversationVersionKey, historicalTailBlocks],
  );
  const confirmedLiveValue = useDesktopConversation ? (visibleConversationBootstrap?.liveSession?.live ?? null) : null;

  useEffect(() => {
    if (draft || !id || deferConversationFileRefresh) {
      return;
    }

    deferredConversationFileVersionRef.current = {
      conversationId: id,
      version: conversationEventVersion,
    };
  }, [conversationEventVersion, deferConversationFileRefresh, draft, id]);

  // ── Desktop bridge is the only stream path. If the bridge is unavailable
  // the conversation is read-only — no live streaming is possible.
  const stream =
    useDesktopConversation && visibleDesktopConversationState
      ? {
          ...visibleDesktopConversationState.stream,
          surfaceId: desktopConversation.surfaceId,
          reconnect: desktopConversation.reconnect,
          send: desktopConversation.send,
          abort: desktopConversation.abort,
          takeover: desktopConversation.takeover,
        }
      : {
          ...INITIAL_STREAM_STATE,
          surfaceId: '',
          reconnect: async () => {},
          send: async () => undefined,
          abort: async () => {},
          takeover: async () => {},
        };
  const streamSend = stream.send;
  const streamAbort = stream.abort;
  const streamReconnect = stream.reconnect;
  const streamTakeover = stream.takeover;
  const desktopConversationRefresh = desktopConversation.refresh;
  const currentSurfaceId = resolveControllableConversationSurfaceId(stream.surfaceId, stream.presence);

  useEffect(() => {
    const cwdChangeAction = resolveConversationCwdChangeAction({
      conversationId: id,
      cwdChange: stream.cwdChange,
      handledKey: handledCwdChangeKeyRef.current,
    });
    if (cwdChangeAction.action === 'none') {
      return;
    }

    handledCwdChangeKeyRef.current = cwdChangeAction.key;
    if (stream.cwdChange?.autoContinued) {
      setPendingAssistantStatusLabel('Working…');
    }

    if (cwdChangeAction.action === 'navigate') {
      ensureConversationTabOpen(cwdChangeAction.conversationId);
      navigate(`/conversations/${cwdChangeAction.conversationId}`);
      return;
    }

    streamReconnect();
  }, [id, navigate, stream.cwdChange, streamReconnect]);

  useLayoutEffect(() => {
    if (!id || draft) {
      return;
    }

    ensureConversationOpenStart(id, 'route');
  }, [draft, id]);

  // Confirm live status via bootstrap/session snapshots and probe live-only queue state only when needed.
  useEffect(() => {
    if (desktopConversationChecking) {
      return;
    }

    if (useDesktopConversation) {
      setConfirmedLive(visibleConversationBootstrap?.liveSession?.live ?? false);
      setLiveSessionHasStaleTurnState(
        visibleConversationBootstrap?.liveSession?.live === true && visibleConversationBootstrap.liveSession.hasStaleTurnState === true,
      );
      return;
    }

    if (!id) {
      setConfirmedLive(false);
      setLiveSessionHasStaleTurnState(false);
      setRecoveredLiveSessionIsRunning(false);
      return;
    }

    if (visibleConversationBootstrap?.liveSession?.live) {
      setConfirmedLive(true);
      setLiveSessionHasStaleTurnState(visibleConversationBootstrap.liveSession.hasStaleTurnState === true);
      setRecoveredLiveSessionIsRunning(null);
      return;
    }

    if (visibleConversationBootstrap?.liveSession?.live === false || sessionSnapshot?.isLive === false) {
      setConfirmedLive(false);
      setLiveSessionHasStaleTurnState(false);
      setRecoveredLiveSessionIsRunning(false);
      return;
    }

    setConfirmedLive(sessionSnapshot?.isLive === true ? true : null);
    setRecoveredLiveSessionIsRunning(null);
    let cancelled = false;

    api
      .liveSession(id)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setConfirmedLive(response.live);
        setLiveSessionHasStaleTurnState(response.live && response.hasStaleTurnState === true);
        setRecoveredLiveSessionIsRunning(response.live ? response.running === true || response.isStreaming === true : false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        if (message.startsWith('404 ') || (sessionsLoaded && sessionSnapshot?.isLive !== true)) {
          setConfirmedLive(false);
        }
        setLiveSessionHasStaleTurnState(false);
        setRecoveredLiveSessionIsRunning(false);
      });

    return () => {
      cancelled = true;
    };
  }, [desktopConversationChecking, useDesktopConversation, visibleConversationBootstrap?.liveSession, id, sessionSnapshot, sessionsLoaded]);

  const isLiveSession = resolveConversationLiveSession({
    streamBlockCount: stream.blocks.length,
    isStreaming: stream.isStreaming,
    confirmedLive: useDesktopConversation ? confirmedLiveValue : confirmedLive,
  });
  const conversationLiveDecision =
    visibleConversationBootstrap?.liveSession?.live ??
    sessionSnapshot?.isLive ??
    (useDesktopConversation ? confirmedLiveValue : confirmedLive);
  useEffect(() => {
    const previous = previousConversationLiveDecisionRef.current;
    const currentIsLive = conversationLiveDecision === true ? true : conversationLiveDecision === false ? false : null;

    if (
      shouldResetConversationTranscriptTailBlocksForLiveTransition({
        conversationId: id,
        currentTailBlocks: historicalTailBlocks,
        isLive: currentIsLive === true,
        previousConversationId: previous.conversationId,
        previousIsLive: previous.isLive,
      })
    ) {
      setHistoricalTailBlocks(INITIAL_HISTORICAL_TAIL_BLOCKS);
      setAutoAnchorTranscriptTail(true);
    }

    previousConversationLiveDecisionRef.current = {
      conversationId: id ?? null,
      isLive: currentIsLive,
    };
  }, [conversationLiveDecision, historicalTailBlocks, id]);
  const conversationNeedsTakeover = false;
  const rawComposerRunState = resolveConversationComposerRunState({
    streamIsStreaming: stream.isStreaming,
    sessionIsRunning: conversationRuntimeIsRunning,
    recoveredLiveSessionIsRunning,
    bootstrapLiveSessionIsStreaming:
      visibleConversationBootstrap?.liveSession?.live === true ? visibleConversationBootstrap.liveSession.isStreaming : false,
    desktopLiveSessionIsStreaming:
      visibleDesktopConversationState?.liveSession?.live === true ? visibleDesktopConversationState.liveSession.isStreaming : false,
    hasStaleTurnState: liveSessionHasStaleTurnState,
  });
  const [latchedStreamControlsActive, setLatchedStreamControlsActive] = useState(rawComposerRunState.streamControlsActive);

  useEffect(() => {
    if (rawComposerRunState.streamControlsActive) {
      setLatchedStreamControlsActive(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLatchedStreamControlsActive(false);
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [rawComposerRunState.streamControlsActive]);

  const composerRunState = useMemo(
    () => ({
      allowQueuedPrompts: latchedStreamControlsActive || liveSessionHasStaleTurnState,
      defaultComposerBehavior: latchedStreamControlsActive ? 'steer' : liveSessionHasStaleTurnState ? 'followUp' : undefined,
      streamControlsActive: latchedStreamControlsActive,
    }),
    [latchedStreamControlsActive, liveSessionHasStaleTurnState],
  );
  const allowQueuedPrompts = composerRunState.allowQueuedPrompts;
  const defaultComposerBehavior = composerRunState.defaultComposerBehavior;
  const conversationRunningForPage = composerRunState.streamControlsActive || liveSessionHasStaleTurnState;

  useEffect(() => {
    setHistoricalTailBlocks(INITIAL_HISTORICAL_TAIL_BLOCKS);
    setInitialHistoricalWarmupConversationId(draft || !id ? null : id);
    setAutoAnchorTranscriptTail(true);
  }, [draft, id]);

  // ── Existing session data (read-only JSONL) ───────────────────────────────
  useEffect(() => {
    if (useDesktopConversation || !id || !bootstrapSessionDetail) {
      return;
    }

    primeSessionDetailCache(id, bootstrapSessionDetail, { tailBlocks: historicalTailBlocks }, effectiveConversationEventVersion);
  }, [bootstrapSessionDetail, effectiveConversationEventVersion, historicalTailBlocks, id, useDesktopConversation]);

  const bootstrapPendingInitialSessionDetail = Boolean(id) && conversationBootstrapLoading && !bootstrapSessionDetail;
  const {
    detail: webSessionDetail,
    loading: webSessionLoading,
    error: webSessionError,
  } = useSessionDetail(
    bootstrapPendingInitialSessionDetail ||
      (useDesktopConversation && !shouldFetchSavedDesktopSessionDetailFallback) ||
      desktopConversationChecking
      ? undefined
      : id,
    {
      tailBlocks: historicalTailBlocks,
      version: effectiveConversationEventVersion,
    },
  );
  const sessionDetail = useDesktopConversation
    ? shouldUseWebBootstrapForDesktopTail
      ? (bootstrapSessionDetail ?? visibleDesktopSessionDetail ?? webSessionDetail)
      : (visibleDesktopSessionDetail ?? bootstrapSessionDetail ?? webSessionDetail)
    : webSessionDetail;
  const sessionLoading = useDesktopConversation
    ? desktopConversation.loading && !sessionDetail
    : desktopConversationChecking
      ? true
      : webSessionLoading;
  const sessionError = useDesktopConversation ? desktopConversation.error : desktopConversationChecking ? null : webSessionError;
  const visibleSessionDetail = useDesktopConversation
    ? sessionDetail
    : sessionDetail?.meta.id === id
      ? sessionDetail
      : bootstrapSessionDetail;

  useEffect(() => {
    if (draft || !id) {
      return;
    }

    const hasConfirmedConversation =
      Boolean(sessionSnapshot) ||
      (!sessionsLoaded && Boolean(visibleSessionDetail)) ||
      visibleConversationBootstrap?.liveSession?.live === true;
    if (!hasConfirmedConversation) {
      return;
    }

    ensureConversationTabOpen(id);
    setActiveConversationTab(id);
  }, [draft, id, sessionSnapshot, sessionsLoaded, visibleConversationBootstrap?.liveSession?.live, visibleSessionDetail]);

  const [hydratedHistoricalBlocks, setHydratedHistoricalBlocks] = useState<Record<string, MessageBlock>>({});
  const [hydratedHistoricalEntryClusters, setHydratedHistoricalEntryClusters] = useState<Record<string, MessageBlock[]>>({});
  const [hydratingHistoricalBlockIds, setHydratingHistoricalBlockIds] = useState<string[]>([]);
  const hydratingHistoricalBlockIdSet = useMemo(
    () => buildHydratingHistoricalBlockIdSet(hydratingHistoricalBlockIds),
    [hydratingHistoricalBlockIds],
  );

  useEffect(() => {
    setHydratedHistoricalBlocks({});
    setHydratedHistoricalEntryClusters({});
    setHydratingHistoricalBlockIds([]);
    setRequestedFocusMessageIndex(null);
    pendingJumpMessageIndexRef.current = null;
  }, [id]);

  const hydrateHistoricalBlock = useCallback(
    async (blockId: string) => {
      const normalizedBlockId = normalizeHistoricalBlockId(blockId);
      if (!id || !normalizedBlockId || hydratingHistoricalBlockIds.includes(normalizedBlockId)) {
        return;
      }

      setHydratingHistoricalBlockIds((current) => addHydratingHistoricalBlockId(current, normalizedBlockId));

      try {
        const deferredEntryIds = parseDeferredEntryHydrationId(normalizedBlockId);
        if (deferredEntryIds) {
          const { blocks } = await api.sessionEntryBlocks(id, deferredEntryIds);
          setHydratedHistoricalEntryClusters((current) => ({
            ...current,
            [normalizedBlockId]: blocks.map(displayBlockToMessageBlock),
          }));
        } else {
          const block = await api.sessionBlock(id, normalizedBlockId);
          const messageBlock = displayBlockToMessageBlock(block);
          setHydratedHistoricalBlocks((current) => ({
            ...current,
            [normalizedBlockId]: messageBlock,
            ...(messageBlock.id && messageBlock.id !== normalizedBlockId ? { [messageBlock.id]: messageBlock } : {}),
          }));
        }
      } catch (error) {
        console.error('Failed to hydrate historical block', error);
        addNotification({
          type: 'warning',
          message: 'Failed to load message details',
          details: error instanceof Error ? error.message : String(error),
          source: 'core',
        });
      } finally {
        setHydratingHistoricalBlockIds((current) => removeHydratingHistoricalBlockId(current, normalizedBlockId));
      }
    },
    [hydratingHistoricalBlockIds, id],
  );

  const hydratedHistoricalBlockCount = Object.keys(hydratedHistoricalBlocks).length;
  const hydratedHistoricalEntryClusterCount = Object.keys(hydratedHistoricalEntryClusters).length;

  // Historical messages from the JSONL snapshot (doesn't update after load).
  // Memoize the conversion so typing in the composer does not rebuild long transcripts.
  const baseMessages = useMemo<MessageBlock[]>(
    () =>
      measureClientPerfTiming(
        {
          name: 'conversation.mergeHydratedHistoricalBlocks',
          minDurationMs: 8,
          meta: {
            conversationId: id,
            blockCount: visibleSessionDetail?.blocks.length ?? 0,
            hydratedBlockCount: hydratedHistoricalBlockCount,
            hasPrecomputedRenderItems: Boolean(visibleSessionDetail?.renderItems?.length),
          },
        },
        () => {
          if (!visibleSessionDetail) {
            return [];
          }

          if (visibleSessionDetail.renderItems?.length) {
            return transcriptRenderItemsToMessageBlocks(
              visibleSessionDetail.renderItems,
              hydratedHistoricalBlocks,
              hydratedHistoricalEntryClusters,
            );
          }

          return mergeHydratedHistoricalBlocks(visibleSessionDetail.blocks, hydratedHistoricalBlocks);
        },
      ),
    [
      hydratedHistoricalBlockCount,
      hydratedHistoricalBlocks,
      hydratedHistoricalEntryClusterCount,
      hydratedHistoricalEntryClusters,
      id,
      visibleSessionDetail,
    ],
  );
  const visibleStreamBlocks = useMemo<MessageBlock[]>(
    () =>
      measureClientPerfTiming(
        {
          name: 'conversation.mergeHydratedStreamBlocks',
          minDurationMs: 8,
          meta: {
            conversationId: id,
            blockCount: stream.blocks.length,
            hydratedBlockCount: hydratedHistoricalBlockCount,
          },
        },
        () => mergeHydratedStreamBlocks(stream.blocks, hydratedHistoricalBlocks),
      ),
    [hydratedHistoricalBlockCount, hydratedHistoricalBlocks, id, stream.blocks],
  );

  // Pending steer/followup queue as reported by the live session.
  const pendingQueue = useMemo(() => buildConversationPendingQueueItems(stream.pendingQueue), [stream.pendingQueue]);

  // Live sessions hydrate from the SSE snapshot; until that arrives, fall back to
  // JSONL + live deltas only when we have at least one source of blocks.
  const computedMessagesRaw = useMemo<MessageBlock[] | undefined>(
    () =>
      measureClientPerfTiming(
        {
          name: 'conversation.resolveComputedMessagesRaw',
          minDurationMs: 8,
          meta: {
            conversationId: id,
            isLiveSession,
            streamHasSnapshot: stream.hasSnapshot,
            baseMessageCount: baseMessages.length,
            streamBlockCount: visibleStreamBlocks.length,
          },
        },
        () =>
          resolveComputedMessagesRaw({
            draft,
            draftPendingPrompt,
            isLiveSession,
            streamHasSnapshot: stream.hasSnapshot,
            visibleStreamBlocks,
            baseMessages,
            pendingInitialPrompt,
            visibleSessionDetailAvailable: Boolean(visibleSessionDetail),
            mergeHistoricalAndStreamBlocks,
            appendPendingInitialPromptBlock,
          }),
      ),
    [
      baseMessages,
      draft,
      draftPendingPrompt,
      isLiveSession,
      pendingInitialPrompt,
      stream.hasSnapshot,
      visibleSessionDetail,
      visibleStreamBlocks,
    ],
  );
  const computedHistoricalBlockOffsetRaw = stream.hasSnapshot ? stream.blockOffset : (visibleSessionDetail?.blockOffset ?? 0);
  const computedHistoricalTotalBlocksRaw = stream.hasSnapshot
    ? stream.totalBlocks
    : (visibleSessionDetail?.totalBlocks ?? computedMessagesRaw?.length ?? 0);
  const actualTranscriptMessageCount = baseMessages.length + visibleStreamBlocks.length;

  // Prune old transcript blocks above MAX_RENDERED_BLOCKS so the renderer doesn't
  // accumulate thousands of blocks in memory. Dropped blocks are still on disk and
  // re-fetched if the user scrolls back up.
  const { computedMessages, computedHistoricalBlockOffset, computedHistoricalTotalBlocks } = useMemo(() => {
    return measureClientPerfTiming(
      {
        name: 'conversation.pruneComputedMessages',
        minDurationMs: 8,
        meta: {
          conversationId: id,
          messageCount: computedMessagesRaw?.length ?? 0,
          historicalBlockOffset: computedHistoricalBlockOffsetRaw,
          historicalTotalBlocks: computedHistoricalTotalBlocksRaw,
          historicalTailBlocks,
          maxRenderedBlocks: MAX_RENDERED_BLOCKS,
        },
      },
      () =>
        pruneComputedMessages({
          messages: computedMessagesRaw,
          historicalBlockOffset: computedHistoricalBlockOffsetRaw,
          historicalTotalBlocks: computedHistoricalTotalBlocksRaw,
          historicalTailBlocks,
          maxRenderedBlocks: MAX_RENDERED_BLOCKS,
        }),
    );
  }, [computedHistoricalBlockOffsetRaw, computedHistoricalTotalBlocksRaw, computedMessagesRaw, historicalTailBlocks, id]);

  const [stableTranscriptState, setStableTranscriptState] = useState<{
    conversationId: string;
    messages: MessageBlock[];
    historicalBlockOffset: number;
    historicalTotalBlocks: number;
  } | null>(null);
  const visibleTranscriptActionStateRef = useRef<{
    conversationId: string;
    messages: MessageBlock[];
    historicalBlockOffset: number;
  } | null>(null);

  useEffect(() => {
    if (!id || !computedMessages || computedMessages.length === 0) {
      return;
    }

    setStableTranscriptState((current) => {
      if (
        current &&
        current.conversationId === id &&
        current.messages === computedMessages &&
        current.historicalBlockOffset === computedHistoricalBlockOffset &&
        current.historicalTotalBlocks === computedHistoricalTotalBlocks
      ) {
        return current;
      }

      return {
        conversationId: id,
        messages: computedMessages,
        historicalBlockOffset: computedHistoricalBlockOffset,
        historicalTotalBlocks: computedHistoricalTotalBlocks,
      };
    });
  }, [computedHistoricalBlockOffset, computedHistoricalTotalBlocks, computedMessages, id]);

  const preservedTranscriptState = id && stableTranscriptState?.conversationId === id ? stableTranscriptState : null;
  const realMessages = computedMessages && computedMessages.length > 0 ? computedMessages : preservedTranscriptState?.messages;
  const historicalBlockOffset =
    computedMessages && computedMessages.length > 0
      ? computedHistoricalBlockOffset
      : (preservedTranscriptState?.historicalBlockOffset ?? computedHistoricalBlockOffset);
  const historicalTotalBlocks =
    computedMessages && computedMessages.length > 0
      ? computedHistoricalTotalBlocks
      : (preservedTranscriptState?.historicalTotalBlocks ?? computedHistoricalTotalBlocks);
  const knownHistoricalTotalBlocks = Math.max(historicalTotalBlocks, sessionSnapshot?.messageCount ?? 0);
  const historicalHasOlderBlocks = historicalBlockOffset > 0;
  const knownHistoricalHasOlderBlocks = knownHistoricalTotalBlocks > historicalTailBlocks;
  const initialHistoricalWarmupActive = Boolean(id) && initialHistoricalWarmupConversationId === id;
  const initialHistoricalWarmupTarget = resolveConversationInitialHistoricalWarmupTarget({
    draft,
    conversationId: initialHistoricalWarmupActive ? id : null,
    liveDecision: conversationLiveDecision,
    historicalTotalBlocks: knownHistoricalTotalBlocks,
    historicalHasOlderBlocks: historicalHasOlderBlocks || knownHistoricalHasOlderBlocks,
  });
  const initialHistoricalWarmupTailLoaded = hasConversationLoadedHistoricalTailBlocks(visibleSessionDetail, initialHistoricalWarmupTarget);
  const showHistoricalLoadMore = historicalHasOlderBlocks;
  const messageIndexOffset = historicalBlockOffset;
  const messageCount = realMessages?.length ?? 0;
  const hasRenderableMessages = messageCount > 0;
  const initialScrollKey = useMemo(
    () =>
      getConversationInitialScrollKey(id ?? null, {
        isLiveSession,
        hasLiveSnapshot: stream.hasSnapshot,
      }),
    [id, isLiveSession, stream.hasSnapshot],
  );
  const hydratingLiveConversation = isLiveSession && !stream.hasSnapshot && !visibleSessionDetail && stream.blocks.length === 0;
  const showBootstrapLoadingState = shouldShowConversationBootstrapLoadingState({
    draft,
    conversationId: id,
    conversationBootstrapLoading,
    hasRenderableMessages,
    hasVisibleSessionDetail: Boolean(visibleSessionDetail),
  });
  const showConversationLoadingState =
    showBootstrapLoadingState || (!hasRenderableMessages && (sessionLoading || hydratingLiveConversation));
  const showNewConversationSetup = shouldShowNewConversationSetup({
    draft,
    hasRenderableMessages,
    showConversationLoadingState,
    hasSessionError: Boolean(sessionError),
  });
  const scrollBinding = resolveConversationVisibleScrollBinding({
    draft,
    routeConversationId: id,
    realMessages,
    stableTranscriptState,
    showConversationLoadingState,
    initialScrollKey,
    isStreaming: stream.isStreaming,
  });
  const pendingAskUserQuestion = useMemo(() => findPendingAskUserQuestion(realMessages), [realMessages]);
  const {
    confirm: pendingExtensionApproval,
    remainingMs: extensionApprovalRemainingMs,
    confirmApproval,
    declineApproval,
  } = useExtensionBackendConfirmations();
  const pendingAskUserQuestionKey = useMemo(() => buildPendingAskUserQuestionKey(pendingAskUserQuestion), [pendingAskUserQuestion]);
  const composerQuestionAnswersStorageKey = useMemo(
    () => buildComposerQuestionAnswersStorageKey(id, pendingAskUserQuestionKey),
    [id, pendingAskUserQuestionKey],
  );
  const [composerQuestionIndex, setComposerQuestionIndex] = useState(0);
  const [composerQuestionOptionIndex, setComposerQuestionOptionIndex] = useState(0);
  const [composerQuestionAnswers, setComposerQuestionAnswers, clearComposerQuestionAnswers] = useReloadState<AskUserQuestionAnswers>({
    storageKey: composerQuestionAnswersStorageKey,
    initialValue: EMPTY_ASK_USER_ANSWERS,
    shouldPersist: hasAskUserQuestionAnswers,
  });
  const [composerQuestionSubmitting, setComposerQuestionSubmitting] = useState(false);
  const artifactAutoOpenSeededRef = useRef(false);
  const artifactAutoOpenStartedAtRef = useRef(new Date().toISOString());
  const processedArtifactAutoOpenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    artifactAutoOpenSeededRef.current = false;
    artifactAutoOpenStartedAtRef.current = new Date().toISOString();
    processedArtifactAutoOpenIdsRef.current = new Set();
  }, [id]);

  useEffect(() => {
    if (!realMessages) {
      return;
    }

    if (!artifactAutoOpenSeededRef.current) {
      processedArtifactAutoOpenIdsRef.current = collectCompletedToolAutoOpenBlockKeys(realMessages, readArtifactPresentation, 'artifact');
      artifactAutoOpenSeededRef.current = true;
      return;
    }

    const nextArtifact = findRequestedToolPresentationToOpen({
      messages: realMessages,
      processedBlockKeys: processedArtifactAutoOpenIdsRef.current,
      autoOpenStartedAt: artifactAutoOpenStartedAtRef.current,
      readPresentation: readArtifactPresentation,
      getTargetId: (artifact) => artifact.artifactId,
      keyPrefix: 'artifact',
    });
    for (const blockKey of nextArtifact.processedBlockKeys) {
      processedArtifactAutoOpenIdsRef.current.add(blockKey);
    }
    if (nextArtifact.targetId) {
      openArtifact(nextArtifact.targetId);
    }
  }, [openArtifact, realMessages]);

  const { titles, setTitle: pushTitle } = useLiveTitles();

  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const conversationHeaderRef = useRef<HTMLDivElement>(null);
  const [conversationHeaderOffset, setConversationHeaderOffset] = useState(96);

  useEffect(() => {
    setTitleOverride(null);
    setIsEditingTitle(false);
    setTitleDraft('');
    setTitleSaving(false);
    setConversationCwdEditorOpen(false);
    setConversationCwdDraft('');
    setConversationCwdPickBusy(false);
    setConversationCwdBusy(false);
    setConversationCwdError(null);
    setSavingPreference(null);
    setNotice(null);

    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }
  }, [id]);

  const title = resolveConversationPageTitle({
    draft,
    titleOverride,
    streamTitle: stream.title,
    liveTitle: id ? titles.get(id) : undefined,
    detailTitle: visibleSessionDetail?.meta.title,
    sessionTitle: sessionSnapshot?.title,
  });
  const model = visibleSessionDetail?.meta.model;

  useLayoutEffect(() => {
    const element = conversationHeaderRef.current;
    if (!element) {
      return;
    }

    const updateHeight = () => {
      const nextHeight = Math.max(0, Math.ceil(element.getBoundingClientRect().height));
      setConversationHeaderOffset((current) => (current === nextHeight ? current : nextHeight));
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [draft, isEditingTitle, title, titleSaving]);

  useEffect(() => {
    const { normalizedTitle, shouldPushLiveTitle } = resolveConversationStreamTitleSync({
      draft,
      conversationId: id,
      streamTitle: stream.title,
      liveTitle: id ? titles.get(id) : undefined,
      sessions,
    });

    if (!normalizedTitle) {
      return;
    }

    if (shouldPushLiveTitle && id && normalizedTitle) {
      pushTitle(id, normalizedTitle);
    }
  }, [draft, id, pushTitle, stream.title, titles]);

  const [nonCriticalComposerMetadataReady, setNonCriticalComposerMetadataReady] = useState(false);
  useEffect(() => {
    setNonCriticalComposerMetadataReady(false);
    const timeout = window.setTimeout(() => setNonCriticalComposerMetadataReady(true), 10_000);
    return () => window.clearTimeout(timeout);
  }, [draft, id]);

  const shouldLoadModels = shouldLoadConversationModelsAfterMetadataReady({
    draft,
    hasPendingInitialPrompt: Boolean(pendingInitialPrompt),
    hasPendingInitialPromptInFlight,
  });

  // Model
  const { models, defaultModel, defaultVisionModel, defaultThinkingLevel, defaultServiceTier } = useConversationModels(shouldLoadModels);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [currentThinkingLevel, setCurrentThinkingLevel] = useState<string>('');
  const [currentServiceTier, setCurrentServiceTier] = useState<string>('');
  const [hasExplicitServiceTier, setHasExplicitServiceTier] = useState(false);
  const resolvedCurrentModelId = useMemo(
    () =>
      resolveSelectableModelId({
        requestedModel: currentModel,
        defaultModel,
        models,
      }),
    [currentModel, defaultModel, models],
  );
  const selectedComposerModel = useMemo(
    () => selectComposerModel(models, currentModel, defaultModel),
    [currentModel, defaultModel, models],
  );
  const createLiveSessionPreferenceInput = useMemo(
    () =>
      buildLiveSessionPreferenceInput({
        resolvedCurrentModelId,
        currentThinkingLevel,
        currentServiceTier,
        hasExplicitServiceTier,
      }),
    [currentThinkingLevel, currentServiceTier, hasExplicitServiceTier, resolvedCurrentModelId],
  );
  const initialModelPreferenceState = useMemo(
    () =>
      resolveConversationInitialModelPreferenceState({
        draft,
        conversationId: id,
        locationState: location.state,
        defaultModel,
        defaultThinkingLevel,
        defaultServiceTier,
      }),
    [defaultModel, defaultThinkingLevel, defaultServiceTier, draft, id, location.state],
  );
  const initialDeferredResumeState = useMemo(
    () =>
      resolveConversationInitialDeferredResumeState({
        draft,
        conversationId: id,
        locationState: location.state,
      }),
    [draft, id, location.state],
  );
  const initialDraftHydrationState = useMemo(
    () =>
      resolveConversationDraftHydrationState({
        draft,
        conversationId: id,
        locationState: location.state,
      }),
    [draft, id, location.state],
  );
  const appliedInitialModelPreferenceLocationKeyRef = useRef<string | null>(null);
  const skippedInitialDeferredResumeLocationKeyRef = useRef<string | null>(null);
  const attemptedDeferredResumeAutoResumeKeyRef = useRef<string | null>(null);
  const overdueDeferredResumeRefreshRef = useRef<{ key: string; atMs: number } | null>(null);
  const liveSessionContextLifecycleRef = useRef({
    disposed: false,
    latestRequestId: 0,
  });
  const conversationAttachmentsLifecycleRef = useRef({
    disposed: false,
    latestRequestId: 0,
  });
  const savedWorkspacePathsLifecycleRef = useRef({
    disposed: false,
    latestRequestId: 0,
    localWriteVersion: 0,
  });
  const [savedWorkspacePaths, setSavedWorkspacePaths] = useState<string[]>(() => readStoredWorkspacePaths());
  const [savedWorkspacePathsLoading, setSavedWorkspacePathsLoading] = useState(false);
  const [draftCwdValue, setDraftCwdValue] = useState('');
  const [draftCwdPickBusy, setDraftCwdPickBusy] = useState(false);
  const [draftCwdError, setDraftCwdError] = useState<string | null>(null);
  const [conversationCwdEditorOpen, setConversationCwdEditorOpen] = useState(false);
  const [conversationCwdDraft, setConversationCwdDraft] = useState('');
  const [conversationCwdPickBusy, setConversationCwdPickBusy] = useState(false);
  const [conversationCwdBusy, setConversationCwdBusy] = useState(false);
  const [conversationCwdError, setConversationCwdError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) {
      setDraftCwdValue('');
      return;
    }

    const syncDraftPreferences = () => {
      setCurrentModel(
        resolveDraftComposerModelId({
          storedDraftModel: readDraftConversationModel(),
          defaultModel,
          models,
        }),
      );
      setCurrentThinkingLevel(readDraftConversationThinkingLevel().trim() || defaultThinkingLevel);
      setCurrentServiceTier(defaultServiceTier);
      setHasExplicitServiceTier(false);
      setDraftCwdValue(readDraftConversationCwd().trim());
    };

    syncDraftPreferences();
    window.addEventListener(DRAFT_CONVERSATION_STATE_CHANGED_EVENT, syncDraftPreferences);
    return () => {
      window.removeEventListener(DRAFT_CONVERSATION_STATE_CHANGED_EVENT, syncDraftPreferences);
    };
  }, [defaultModel, defaultThinkingLevel, defaultServiceTier, draft, models]);

  useEffect(() => {
    if (!draft || models.length === 0) {
      return;
    }

    const storedDraftModel = readDraftConversationModel();
    if (!storedDraftModel || hasSelectableModelId(models, storedDraftModel)) {
      return;
    }

    clearDraftConversationModel();
  }, [draft, models]);

  useEffect(() => {
    const lifecycle = liveSessionContextLifecycleRef.current;
    lifecycle.disposed = false;
    return () => {
      lifecycle.disposed = true;
    };
  }, []);

  useEffect(() => {
    const lifecycle = conversationAttachmentsLifecycleRef.current;
    lifecycle.disposed = false;
    return () => {
      lifecycle.disposed = true;
    };
  }, []);

  useEffect(() => {
    const lifecycle = savedWorkspacePathsLifecycleRef.current;
    lifecycle.disposed = false;
    return () => {
      lifecycle.disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!draft) {
      setDraftCwdPickBusy(false);
      setDraftCwdError(null);
    }
  }, [draft]);

  useEffect(() => {
    const drawingPickerAvailable = !draft && Boolean(id);
    setExtensionCommandContext('drawingPicker.available', drawingPickerAvailable);
    return () => setExtensionCommandContext('drawingPicker.available', null);
  }, [draft, id]);

  useEffect(() => {
    if (draft) {
      return;
    }

    if (!id) {
      setCurrentModel(defaultModel);
      setCurrentThinkingLevel(defaultThinkingLevel);
      setCurrentServiceTier(defaultServiceTier);
      setHasExplicitServiceTier(false);
      return;
    }

    if (initialModelPreferenceState && appliedInitialModelPreferenceLocationKeyRef.current !== location.key) {
      appliedInitialModelPreferenceLocationKeyRef.current = location.key;
      setCurrentModel(initialModelPreferenceState.currentModel);
      setCurrentThinkingLevel(initialModelPreferenceState.currentThinkingLevel);
      setCurrentServiceTier(initialModelPreferenceState.currentServiceTier);
      setHasExplicitServiceTier(initialModelPreferenceState.hasExplicitServiceTier);
      return;
    }

    let cancelled = false;
    api
      .conversationModelPreferences(id)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setCurrentModel(data.currentModel || defaultModel);
        setCurrentThinkingLevel(data.currentThinkingLevel ?? defaultThinkingLevel);
        setCurrentServiceTier(data.currentServiceTier ?? defaultServiceTier);
        setHasExplicitServiceTier(Boolean(data.hasExplicitServiceTier));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setCurrentModel(defaultModel);
        setCurrentThinkingLevel(defaultThinkingLevel);
        setCurrentServiceTier(defaultServiceTier);
        setHasExplicitServiceTier(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    conversationEventVersion,
    defaultModel,
    defaultThinkingLevel,
    defaultServiceTier,
    draft,
    id,
    initialModelPreferenceState,
    location.key,
  ]);

  useEffect(() => {
    if (draft) {
      return;
    }

    if (!id) {
      return;
    }
  }, [conversationEventVersion, draft, id, initialDraftHydrationState]);

  const composerDraftStorageKey = draft ? buildDraftConversationComposerStorageKey() : id ? buildConversationComposerStorageKey(id) : null;
  const browserCommentsStorageKey = buildBrowserCommentsStorageKey(draft, id);

  // Input state
  const [input, setInputState] = useReloadState<string>({
    storageKey: composerDraftStorageKey,
    initialValue: '',
    shouldPersist: (value) => value.length > 0,
  });

  const [extensionSlashCommands, setExtensionSlashCommands] = useState<ExtensionSlashCommandRegistration[]>([]);
  const [extensionMentionRegistrations, setExtensionMentionRegistrations] = useState<ExtensionMentionRegistration[]>([]);
  const [extensionMentionItems, setExtensionMentionItems] = useState<MentionItem[]>([]);
  const [workspaceMentionEntries, setWorkspaceMentionEntries] = useState<WorkspaceEntry[]>([]);

  useEffect(() => {
    const hasAutocompleteDemand = Boolean(parseSlashInput(input)) || /(^|.*\s)(@[\w./-]*)$/.test(input);
    if (!nonCriticalComposerMetadataReady && !hasAutocompleteDemand) {
      return;
    }

    let cancelled = false;
    Promise.all([api.extensionSlashCommands(), api.extensionMentions()])
      .then(([commands, mentions]) => {
        if (!cancelled) {
          setExtensionSlashCommands(commands);
          setExtensionMentionRegistrations(mentions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setExtensionSlashCommands([]);
          setExtensionMentionRegistrations([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [input, nonCriticalComposerMetadataReady]);

  // Current context usage (compaction-aware)
  const sessionTokens = useMemo(
    () =>
      resolveConversationContextUsageTokens({
        isLiveSession,
        liveUsage: stream.contextUsage,
        historicalUsage: visibleSessionDetail?.contextUsage,
        models,
        currentModel,
        routeModel: model,
      }),
    [currentModel, isLiveSession, model, models, stream.contextUsage, visibleSessionDetail?.contextUsage],
  );

  const [liveSessionContext, setLiveSessionContext] = useState<LiveSessionContext | null>(null);
  const [conversationWorkspaceGit, setConversationWorkspaceGit] = useState<{
    branch: string | null;
    changeCount: number;
    linesAdded: number;
    linesDeleted: number;
  } | null>(null);
  const [draftWorkspaceGit, setDraftWorkspaceGit] = useState<{
    branch: string | null;
    changeCount: number;
    linesAdded: number;
    linesDeleted: number;
  } | null>(null);

  const [notice, setNotice] = useState<{ tone: 'accent' | 'danger' | 'warning'; text: string } | null>(null);
  const [savingPreference, setSavingPreference] = useState<'model' | 'thinking' | 'serviceTier' | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);
  const showNotice = useCallback((tone: 'accent' | 'danger' | 'warning', text: string, durationMs = 2500) => {
    setNotice({ tone, text });
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    if (durationMs > 0) {
      noticeTimeoutRef.current = window.setTimeout(() => {
        setNotice(null);
        noticeTimeoutRef.current = null;
      }, durationMs);
    }
  }, []);

  const cancelConversationGoal = useCallback(
    () =>
      cancelConversationGoalViaApi({
        conversationId: id,
        updateGoal: api.updateGoal,
        refreshConversation: desktopConversationRefresh,
        showNotice,
      }),
    [desktopConversationRefresh, id, showNotice],
  );

  const ensureConversationCanControl = useCallback((_action: string): boolean => {
    return true;
  }, []);
  const latestInputRef = useRef(input);
  latestInputRef.current = input;

  const setInput = useCallback(
    (next: string) => {
      latestInputRef.current = next;
      if (draft) {
        persistDraftConversationComposer(next);
      } else if (id) {
        persistForkPromptDraft(id, next);
      }

      setInputState(next);
    },
    [draft, id, setInputState],
  );
  const appliedInitialComposerDraftLocationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const initialComposerDraft = resolveConversationInitialComposerDraftState({
      draft,
      conversationId: id,
      locationState: location.state,
    });
    if (!initialComposerDraft || appliedInitialComposerDraftLocationKeyRef.current === location.key) {
      return;
    }

    appliedInitialComposerDraftLocationKeyRef.current = location.key;
    setInput(initialComposerDraft.text);
  }, [draft, id, location.key, location.state, setInput]);
  const [debouncedRelatedThreadsQuery, setDebouncedRelatedThreadsQuery] = useState(() => input.trim());
  const [relatedThreadSearchIndex, setRelatedThreadSearchIndex] = useState<Record<string, string>>({});
  const [relatedThreadSummaries, setRelatedThreadSummaries] = useState<Record<string, ConversationSummaryRecord>>({});
  const [relatedThreadSearchLoading, setRelatedThreadSearchLoading] = useState(false);
  const [relatedThreadSearchError, setRelatedThreadSearchError] = useState<string | null>(null);
  const [selectedRelatedThreadIds, setSelectedRelatedThreadIds] = useState<string[]>([]);
  const [autoSelectedRelatedThreadIds, setAutoSelectedRelatedThreadIds] = useState<string[]>([]);
  const [preparingRelatedThreadContext, setPreparingRelatedThreadContext] = useState(false);
  const [relatedThreadResultsState, setRelatedThreadResultsState] = useState<{
    visibleResults: RelatedConversationSearchResult[];
    searchResults: RelatedConversationSearchResult[];
  }>({ visibleResults: [], searchResults: [] });
  const keyboardInset = useVisualViewportKeyboardInset();
  const [attachments, setAttachments] = useState<ComposerImageAttachment[]>([]);
  const showTextOnlyImageHint =
    attachments.length > 0 && selectedComposerModel !== null && !selectedComposerModel.input?.includes('image') && !defaultVisionModel;

  useEffect(() => {
    if (showTextOnlyImageHint) {
      showNotice('warning', 'Set a vision model in Settings to inspect attached images.', 0);
    } else if (notice?.text === 'Set a vision model in Settings to inspect attached images.') {
      setNotice(null);
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = null;
      }
    }
  }, [showTextOnlyImageHint]);

  const [drawingAttachments, setDrawingAttachments] = useState<ComposerDrawingAttachment[]>([]);
  const [pendingBrowserComments, setPendingBrowserComments] = useReloadState<PendingBrowserComment[]>({
    storageKey: browserCommentsStorageKey,
    initialValue: EMPTY_PENDING_BROWSER_COMMENTS,
    deserialize: (raw) => normalizePendingBrowserComments(JSON.parse(raw) as unknown),
    shouldPersist: (comments) => comments.length > 0,
  });
  const [drawingsPickerOpen, setDrawingsPickerOpen] = useState(false);
  const [conversationAttachments, setConversationAttachments] = useState<ConversationAttachmentSummary[]>([]);
  const [attachedContextDocs, setAttachedContextDocs] = useState<ConversationContextDocRef[]>([]);
  const [contextDocsBusy, setContextDocsBusy] = useState(false);
  const [drawingsBusy, setDrawingsBusy] = useState(false);
  const [drawingsError, setDrawingsError] = useState<string | null>(null);
  const { composerAltHeld } = useComposerModifierKeys();
  const [dragOver, setDragOver] = useState(false);
  const composerHistoryScopeId = draft ? null : (id ?? null);
  const [composerHistory, setComposerHistory] = useState<string[]>(() => readComposerHistory(composerHistoryScopeId));
  const [composerHistoryIndex, setComposerHistoryIndex] = useState<number | null>(null);
  const composerHistoryDraftRef = useRef('');
  const composerAttachmentScopeKey = draft ? 'draft' : id ? `conversation:${id}` : null;

  useEffect(() => {
    function handleBrowserCommentAdded(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isPendingBrowserComment(detail)) {
        return;
      }
      setPendingBrowserComments((current) => [...current, detail]);
      showNotice('accent', 'Browser comment attached to composer.', 2500);
    }

    window.addEventListener(WORKBENCH_BROWSER_COMMENT_ADDED_EVENT, handleBrowserCommentAdded);
    return () => window.removeEventListener(WORKBENCH_BROWSER_COMMENT_ADDED_EVENT, handleBrowserCommentAdded);
  }, [showNotice]);
  const composerAttachmentsHydratedRef = useRef(false);
  const lastComposerAttachmentScopeKeyRef = useRef<string | null>(composerAttachmentScopeKey);

  if (lastComposerAttachmentScopeKeyRef.current !== composerAttachmentScopeKey) {
    lastComposerAttachmentScopeKeyRef.current = composerAttachmentScopeKey;
    composerAttachmentsHydratedRef.current = false;
  }

  useInitialDraftAttachmentHydration({
    draft,
    conversationId: id,
    enabled: Boolean(initialDraftHydrationState),
    locationKey: location.key,
    setAttachments,
    setDrawingAttachments,
  });

  useLayoutEffect(() => {
    const storedAttachments = draft
      ? readDraftConversationAttachments()
      : id
        ? readConversationAttachments(id)
        : { images: [], drawings: [] };
    const fallbackNamePrefix = draft ? 'draft-image' : id ? `conversation-${id}-image` : 'conversation-image';

    setAttachments(restoreComposerImageFiles(storedAttachments.images, fallbackNamePrefix));
    setDrawingAttachments(storedAttachments.drawings);
    setDrawingsPickerOpen(false);
    setConversationAttachments([]);
    setAttachedContextDocs(draft ? readDraftConversationContextDocs() : []);
    setDrawingsError(null);
    setDragOver(false);
    composerAttachmentsHydratedRef.current = true;
  }, [draft, id]);

  useEffect(() => {
    if (!composerAttachmentsHydratedRef.current || (!draft && !id)) {
      return;
    }

    const mutationVersion = beginDraftConversationAttachmentsMutation();
    const images = buildPromptImages(attachments);
    if (!isDraftConversationAttachmentsMutationCurrent(mutationVersion)) {
      return;
    }

    const nextAttachments = {
      images,
      drawings: drawingAttachments,
    };

    if (draft) {
      persistDraftConversationAttachments(nextAttachments);
      return;
    }

    if (id) {
      persistConversationAttachments(id, nextAttachments);
    }
  }, [attachments, draft, drawingAttachments, id]);

  useEffect(() => {
    setComposerHistory(readComposerHistory(composerHistoryScopeId));
    setComposerHistoryIndex(null);
    composerHistoryDraftRef.current = '';
  }, [composerHistoryScopeId]);

  useEffect(() => {
    if (composerHistoryIndex === null) {
      return;
    }

    if (input === composerHistory[composerHistoryIndex]) {
      return;
    }

    setComposerHistoryIndex(null);
    composerHistoryDraftRef.current = '';
  }, [composerHistory, composerHistoryIndex, input]);

  const restoreComposerDraft = useCallback(
    async (nextInput: string, nextAttachments: ComposerImageAttachment[], nextDrawingAttachments: ComposerDrawingAttachment[]) => {
      try {
        const images = buildPromptImages(nextAttachments);
        const persistedAttachments = {
          images,
          drawings: nextDrawingAttachments,
        };

        if (draft) {
          persistDraftConversationAttachments(persistedAttachments);
        } else if (id) {
          if (nextAttachments.length === 0 && nextDrawingAttachments.length === 0) {
            clearConversationAttachments(id);
          } else {
            persistConversationAttachments(id, persistedAttachments);
          }
        }
      } catch {
        // Ignore composer attachment draft restoration failures.
      }

      setInput(nextInput);
      setAttachments(nextAttachments);
      setDrawingAttachments(nextDrawingAttachments);
    },
    [draft, id, setInput],
  );

  useEffect(() => {
    if (draft || !id) {
      setPendingInitialPrompt(null);
      setPendingInitialPromptDispatchingState(false);
      pendingInitialPromptSessionIdRef.current = null;
      pendingInitialPromptFailureSessionIdRef.current = null;
      pinnedInitialPromptScrollSessionIdRef.current = null;
      pinnedInitialPromptTailKeyRef.current = null;
      return;
    }

    const initialPromptAlreadySubmitted =
      hasConversationInitialPromptAlreadySubmitted({
        draft,
        conversationId: id,
        locationState: location.state,
      }) || consumeConversationInitialPromptAlreadySubmitted(id);
    setPendingInitialPrompt(
      initialPromptAlreadySubmitted
        ? null
        : (resolveConversationInitialPendingPromptState({ draft, conversationId: id, locationState: location.state }) ??
            readPendingConversationPrompt(id)),
    );
    setPendingInitialPromptDispatchingState(initialPromptAlreadySubmitted ? false : isPendingConversationPromptDispatching(id));
    pendingInitialPromptSessionIdRef.current = null;
    pendingInitialPromptFailureSessionIdRef.current = null;
    pinnedInitialPromptScrollSessionIdRef.current = null;
    pinnedInitialPromptTailKeyRef.current = null;
  }, [draft, id, location.state]);

  useEffect(() => {
    if (draft || !id || typeof window === 'undefined') {
      return;
    }

    const handlePendingPromptChange = (event: Event) => {
      const detail = (event as CustomEvent<PendingConversationPromptChangedDetail>).detail;
      if (!detail || detail.sessionId !== id) {
        return;
      }

      setPendingInitialPrompt(detail.prompt);
      setPendingInitialPromptDispatchingState(detail.dispatching);
    };

    window.addEventListener(PENDING_CONVERSATION_PROMPT_CHANGED_EVENT, handlePendingPromptChange);
    return () => {
      window.removeEventListener(PENDING_CONVERSATION_PROMPT_CHANGED_EVENT, handlePendingPromptChange);
    };
  }, [draft, id]);

  useEffect(() => {
    if (
      !shouldClearAcceptedPendingInitialPrompt({
        draft,
        conversationId: id,
        pendingInitialPrompt,
        pendingInitialPromptDispatching,
        messages: realMessages,
        visibleTranscriptMessageCount: actualTranscriptMessageCount,
      })
    ) {
      return;
    }

    clearPendingConversationPrompt(id);
    setPendingConversationPromptDispatching(id, false);
    setPendingInitialPrompt(null);
    setPendingInitialPromptDispatchingState(false);
  }, [actualTranscriptMessageCount, draft, id, pendingInitialPrompt, pendingInitialPromptDispatching, realMessages]);

  useEffect(() => {
    if (
      !shouldClearStalePendingInitialPrompt({
        draft,
        conversationId: id,
        pendingInitialPrompt,
        pendingInitialPromptDispatching,
        messageCount: realMessages?.length ?? 0,
      })
    ) {
      return;
    }

    clearPendingConversationPrompt(id);
    setPendingInitialPrompt(null);
    setPendingInitialPromptDispatchingState(false);
  }, [draft, id, pendingInitialPrompt, pendingInitialPromptDispatching, realMessages]);

  useEffect(() => {
    if (shouldResetPendingInitialPromptFailureSession({ conversationId: id, pendingInitialPrompt })) {
      pendingInitialPromptFailureSessionIdRef.current = null;
    }
  }, [id, pendingInitialPrompt]);

  useEffect(() => {
    if (shouldClearDraftPendingPrompt(draft)) {
      setDraftPendingPrompt(null);
    }
  }, [draft, id]);

  const [pendingAssistantStatusLabel, setPendingAssistantStatusLabel] = useState<string | null>(null);
  const [wholeLineBashRunning, setWholeLineBashRunning] = useState(false);
  const wholeLineBashRunningRef = useRef(false);
  const pendingWholeLineBashRef = useRef<{ conversationId: string; command: string } | null>(null);
  const composerSubmitRunningRef = useRef(false);
  const [showBackgroundRunDetails, setShowBackgroundRunDetails] = useState(false);

  const composerDisabled = isConversationComposerDisabled({
    conversationNeedsTakeover,
    preparingRelatedThreadContext,
    wholeLineBashRunning,
    hasAvailableModel: models.length > 0,
  });

  useEffect(() => {
    setPendingAssistantStatusLabel(null);
    setShowBackgroundRunDetails(false);
  }, [id]);

  useEffect(() => {
    const pending = pendingWholeLineBashRef.current;
    if (!pending || pending.conversationId !== id) {
      return;
    }
    if (!shouldReleaseWholeLineBashLock({ messages: realMessages, command: pending.command })) {
      return;
    }

    pendingWholeLineBashRef.current = null;
    wholeLineBashRunningRef.current = false;
    setWholeLineBashRunning(false);
    setPendingAssistantStatusLabel(null);
  }, [id, realMessages]);

  useEffect(() => {
    if (!shouldClearPendingAssistantStatus(stream.isStreaming)) {
      return;
    }

    setPendingAssistantStatusLabel(null);
  }, [stream.isStreaming]);

  const prevStreamingRef = useRef(false);
  const autocompleteCatalogDemand = useMemo(() => resolveConversationAutocompleteCatalogDemand(input), [input]);
  const [shouldLoadMemoryData, setShouldLoadMemoryData] = useState(() => autocompleteCatalogDemand.needsMemoryData);
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const requestedMemoryDataRef = useRef(false);
  const conversationRunId = useMemo(() => (id ? createConversationLiveRunId(id) : null), [id]);
  const [conversationRun, setConversationRun] = useState<DurableRunRecord | null>(null);
  const [resumeConversationBusy, setResumeConversationBusy] = useState(false);
  const [deferredResumes, setDeferredResumes] = useState<DeferredResumeSummary[]>([]);
  const [deferredResumesBusy, setDeferredResumesBusy] = useState(false);
  const [showDeferredResumeDetails, setShowDeferredResumeDetails] = useState(false);
  const [showScheduledTaskDetails, setShowScheduledTaskDetails] = useState(false);
  const [cancellingBackgroundRunIds, setCancellingBackgroundRunIds] = useState<Set<string>>(() => new Set());
  const [deferredResumeNowMs, setDeferredResumeNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (draft || runRecords.length > 0) {
      return;
    }

    let cancelled = false;
    void api
      .runs()
      .then((result) => {
        if (!cancelled) {
          runStore.replaceAll(result.runs ?? []);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [draft, runRecords]);

  const cancelBackgroundRunFromShelf = useCallback(
    (runId: string) => {
      const normalizedRunId = runId.trim();
      if (!normalizedRunId) {
        return;
      }

      setCancellingBackgroundRunIds((current) => new Set(current).add(normalizedRunId));
      void api
        .cancelExecution(normalizedRunId)
        .then(() => desktopConversationRefresh())
        .catch(() => {})
        .finally(() => {
          setCancellingBackgroundRunIds((current) => {
            const next = new Set(current);
            next.delete(normalizedRunId);
            return next;
          });
        });
    },
    [desktopConversationRefresh],
  );

  useEffect(() => {
    if (autocompleteCatalogDemand.needsMemoryData) {
      setShouldLoadMemoryData(true);
    }
  }, [autocompleteCatalogDemand.needsMemoryData]);

  useEffect(() => {
    if (!autocompleteCatalogDemand.needsTaskData) {
      return;
    }

    let cancelled = false;
    void api
      .tasks()
      .then((items) => {
        if (!cancelled) {
          taskStore.replaceAll(items);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [autocompleteCatalogDemand.needsTaskData]);

  useEffect(() => {
    if (!shouldLoadMemoryData || requestedMemoryDataRef.current) {
      return;
    }

    requestedMemoryDataRef.current = true;
    let cancelled = false;

    api
      .memory()
      .then((data) => {
        if (!cancelled) {
          setMemoryData(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [shouldLoadMemoryData]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerShellRef = useRef<HTMLDivElement | null>(null);
  const [composerShellWidth, setComposerShellWidth] = useState<number | null>(null);
  const [transcriptBottomPaddingPx, setTranscriptBottomPaddingPx] = useState(96);
  const composerSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const composerMenuStateRef = useRef<Pick<UseConversationComposerMenusState, 'resetMenus'> | null>(null);
  const composerResizeFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPrefetchUserIntentRef = useRef(false);
  const lastHistoricalPrefetchRequestedAtRef = useRef(0);
  const pendingJumpMessageIndexRef = useRef<number | null>(null);
  const [requestedFocusMessageIndex, setRequestedFocusMessageIndex] = useState<number | null>(null);

  useEffect(() => {
    setComposerQuestionIndex(0);
    setComposerQuestionOptionIndex(0);
    setComposerQuestionSubmitting(false);
  }, [pendingAskUserQuestionKey]);

  const composerActiveQuestion =
    pendingAskUserQuestion?.presentation.questions[
      Math.max(0, Math.min(composerQuestionIndex, (pendingAskUserQuestion?.presentation.questions.length ?? 1) - 1))
    ] ?? null;

  useLayoutEffect(() => {
    const element = composerShellRef.current;
    if (!element) {
      return;
    }

    const updateComposerMetrics = () => {
      const rect = element.getBoundingClientRect();
      const nextWidth = Math.max(0, Math.floor(rect.width));
      const nextBottomPadding = Math.max(96, Math.ceil(rect.height + 48));
      setComposerShellWidth((current) => (current === nextWidth ? current : nextWidth));
      setTranscriptBottomPaddingPx((current) => (current === nextBottomPadding ? current : nextBottomPadding));
    };

    updateComposerMetrics();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateComposerMetrics);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!composerActiveQuestion) {
      setComposerQuestionOptionIndex(0);
      return;
    }

    setComposerQuestionOptionIndex(resolveAskUserQuestionDefaultOptionIndex(composerActiveQuestion, composerQuestionAnswers));
  }, [composerActiveQuestion, composerQuestionAnswers]);

  const { atBottom, syncScrollStateFromDom, scrollToBottom, capturePrependRestore } = useConversationScroll({
    conversationId: scrollBinding.conversationId,
    messages: scrollBinding.messages,
    scrollRef,
    sessionLoading,
    isStreaming: scrollBinding.isStreaming,
    initialScrollKey: scrollBinding.initialScrollKey,
    prependRestoreKey: historicalBlockOffset,
    messageIndexOffset,
  });
  const showInitialHistoricalWarmupLoader = shouldShowConversationInitialHistoricalWarmupLoader({
    warmupActive: initialHistoricalWarmupActive,
    targetTailBlocks: initialHistoricalWarmupTarget,
    currentTailBlocks: historicalTailBlocks,
    loadedTailBlocks: initialHistoricalWarmupTailLoaded,
  });
  const previousInitialHistoricalWarmupLoaderRef = useRef(false);

  useEffect(() => {
    if (!initialHistoricalWarmupActive || !id) {
      return;
    }

    if (conversationLiveDecision === true || knownHistoricalTotalBlocks <= 0) {
      setInitialHistoricalWarmupConversationId(null);
      return;
    }

    if (!historicalHasOlderBlocks && !knownHistoricalHasOlderBlocks) {
      if (conversationBootstrapLoading || sessionLoading) {
        return;
      }

      setInitialHistoricalWarmupConversationId(null);
      return;
    }

    if (conversationLiveDecision !== false || !initialHistoricalWarmupTarget) {
      return;
    }

    if (historicalTailBlocks < initialHistoricalWarmupTarget) {
      setHistoricalTailBlocks(initialHistoricalWarmupTarget);
      return;
    }

    if (!initialHistoricalWarmupTailLoaded) {
      return;
    }

    setInitialHistoricalWarmupConversationId(null);
  }, [
    conversationBootstrapLoading,
    conversationLiveDecision,
    historicalHasOlderBlocks,
    historicalTailBlocks,
    id,
    initialHistoricalWarmupActive,
    initialHistoricalWarmupTailLoaded,
    initialHistoricalWarmupTarget,
    knownHistoricalHasOlderBlocks,
    knownHistoricalTotalBlocks,
    sessionLoading,
  ]);

  useEffect(() => {
    previousInitialHistoricalWarmupLoaderRef.current = false;
  }, [id]);

  useEffect(() => {
    const wasLoading = previousInitialHistoricalWarmupLoaderRef.current;
    previousInitialHistoricalWarmupLoaderRef.current = showInitialHistoricalWarmupLoader;

    if (!wasLoading || showInitialHistoricalWarmupLoader || !id || !realMessages?.length) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [id, realMessages, scrollToBottom, showInitialHistoricalWarmupLoader]);

  const loadOlderMessages = useCallback(
    (targetMessageIndex?: number, options?: { tailBlockStep?: number }) => {
      if (!id || sessionLoading || historicalTotalBlocks <= 0) {
        return;
      }

      if (targetMessageIndex === undefined) {
        setAutoAnchorTranscriptTail(false);
        scrollPrefetchUserIntentRef.current = false;
        lastHistoricalPrefetchRequestedAtRef.current = performance.now();
        capturePrependRestore();
      }

      setHistoricalTailBlocks((currentTailBlocks) => {
        const nextTailBlocks = resolveNextConversationTranscriptTailBlocks({
          currentTailBlocks,
          requestedTailBlockStep: Math.max(1, Math.ceil(options?.tailBlockStep ?? HISTORICAL_TAIL_BLOCKS_STEP)),
          targetMessageIndex,
          totalBlocks: historicalTotalBlocks,
        });

        return nextTailBlocks > currentTailBlocks ? nextTailBlocks : currentTailBlocks;
      });
    },
    [capturePrependRestore, historicalTotalBlocks, id, sessionLoading],
  );

  useEffect(() => {
    let cancelled = false;
    void buildExtensionMentionItems(extensionMentionRegistrations, {
      memoryDocs: memoryData?.memoryDocs ?? [],
    })
      .then((items) => {
        if (!cancelled) setExtensionMentionItems(items);
      })
      .catch(() => {
        if (!cancelled) setExtensionMentionItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [extensionMentionRegistrations, memoryData?.memoryDocs]);

  const mentionItems = useMemo(
    () =>
      buildMentionItems({
        tasks: tasks ?? [],
        memoryDocs: memoryData?.memoryDocs ?? [],
        workspaceEntries: workspaceMentionEntries,
        extensionItems: extensionMentionItems,
      }),
    [tasks, memoryData?.memoryDocs, workspaceMentionEntries, extensionMentionItems],
  );
  const composerPlaceholder = useMemo(
    () => formatConversationComposerPlaceholder(extensionMentionRegistrations),
    [extensionMentionRegistrations],
  );
  const slashItems = useMemo(
    () => buildSlashMenuItems(input, memoryData?.skills ?? [], extensionSlashCommands),
    [extensionSlashCommands, input, memoryData],
  );
  const currentSessionMeta = useMemo(() => {
    const merged = mergeConversationSessionMeta(visibleSessionDetail?.meta, sessionSnapshot);
    if (!merged || conversationRuntimeIsRunning === undefined || merged.isRunning === conversationRuntimeIsRunning) {
      return merged;
    }
    return { ...merged, isRunning: conversationRuntimeIsRunning };
  }, [conversationRuntimeIsRunning, sessionSnapshot, visibleSessionDetail?.meta]);

  useEffect(() => {
    if (draft) {
      return;
    }

    setAttachedContextDocs(currentSessionMeta?.attachedContextDocs ?? []);
  }, [currentSessionMeta?.attachedContextDocs, draft, id]);
  const currentCwd = useMemo(
    () =>
      resolveConversationCurrentCwd({
        draft,
        draftCwdValue,
        liveSessionCwd: liveSessionContext?.cwd,
        sessionCwd: currentSessionMeta?.cwd,
      }),
    [draft, draftCwdValue, liveSessionContext?.cwd, currentSessionMeta?.cwd],
  );
  useEffect(() => {
    if (!currentCwd || currentCwd === 'Chat') {
      setWorkspaceMentionEntries([]);
      return;
    }
    if (!autocompleteCatalogDemand.needsKnowledgeFiles) {
      return;
    }

    let cancelled = false;
    void loadWorkspaceMentionEntries(currentCwd)
      .then((entries) => {
        if (!cancelled) setWorkspaceMentionEntries(entries);
      })
      .catch(() => {
        if (!cancelled) setWorkspaceMentionEntries([]);
      });

    return () => {
      cancelled = true;
    };
  }, [autocompleteCatalogDemand.needsKnowledgeFiles, currentCwd]);
  const [transcriptPathLinkTarget, setTranscriptPathLinkTarget] = useState<TranscriptPathLinkTarget>('fileExplorer');
  useEffect(() => {
    let cancelled = false;

    api
      .settings()
      .then((settings) => {
        if (!cancelled) {
          setTranscriptPathLinkTarget(normalizeTranscriptPathLinkTargetSetting(settings[TRANSCRIPT_PATH_LINK_TARGET_SETTING_KEY]));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTranscriptPathLinkTarget('fileExplorer');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);
  const currentCwdLabel = useMemo(() => formatConversationCwdLabel(currentCwd), [currentCwd]);
  const hasDraftCwd = hasDraftConversationCwd(draftCwdValue);
  const setupWorkspaceCwd = draft ? draftCwdValue || null : currentCwdLabel === 'Chat' ? null : currentCwd;
  const availableDraftWorkspacePaths = useMemo(
    () => buildAvailableDraftWorkspacePaths({ draftCwdValue: setupWorkspaceCwd ?? '', savedWorkspacePaths }),
    [savedWorkspacePaths, setupWorkspaceCwd],
  );
  const availableConversationWorkspacePaths = useMemo(
    () => buildWorkspacePickerPaths({ currentCwd, savedWorkspacePaths }),
    [currentCwd, savedWorkspacePaths],
  );
  const relatedThreadCandidates = useMemo(
    () =>
      selectDraftRelatedThreadCandidates({
        draft: showNewConversationSetup,
        sessions,
        workspaceCwd: setupWorkspaceCwd,
        recentWindowDays: RELATED_THREAD_RECENT_WINDOW_DAYS,
        limit: MAX_RELATED_THREAD_CANDIDATES,
      }),
    [sessions, setupWorkspaceCwd, showNewConversationSetup],
  );
  const relatedThreadCandidateIds = useMemo(() => relatedThreadCandidates.map((candidate) => candidate.id), [relatedThreadCandidates]);
  const relatedThreadCandidateById = useMemo(
    () => new Map(relatedThreadCandidates.map((candidate) => [candidate.id, candidate] as const)),
    [relatedThreadCandidates],
  );
  const visibleRelatedThreadResults = relatedThreadResultsState.visibleResults;
  const relatedThreadSearchResults = relatedThreadResultsState.searchResults;
  const toggleRelatedThreadSelection = useCallback(
    (sessionId: string) => {
      setSelectedRelatedThreadIds((current) => {
        const result = toggleRelatedThreadSelectionIds({
          current,
          sessionId,
          maxSelections: MAX_RELATED_THREAD_SELECTIONS,
        });
        if (result.rejected) {
          showNotice('danger', `Choose up to ${MAX_RELATED_THREAD_SELECTIONS} related threads.`, 2500);
        }
        return result.next;
      });
    },
    [showNotice],
  );
  const branchLabel = draft
    ? (draftWorkspaceGit?.branch ?? null)
    : (liveSessionContext?.branch ?? conversationWorkspaceGit?.branch ?? null);
  const extensionRegistry = useExtensionRegistry();

  useEffect(() => {
    if (!id || draft || extensionRegistry.loading) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      completeConversationOpenPhase(id, 'extensions', {
        extensionCount: extensionRegistry.extensions.length,
        routeCount: extensionRegistry.routes.length,
        surfaceCount: extensionRegistry.surfaces.length,
        composerControlCount: extensionRegistry.composerControls.length,
        composerShelfCount: extensionRegistry.composerShelves.length,
        conversationHeaderElementCount: extensionRegistry.conversationHeaderElements.length,
        error: extensionRegistry.error,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    draft,
    extensionRegistry.composerControls.length,
    extensionRegistry.composerShelves.length,
    extensionRegistry.conversationHeaderElements.length,
    extensionRegistry.error,
    extensionRegistry.extensions.length,
    extensionRegistry.loading,
    extensionRegistry.routes.length,
    extensionRegistry.surfaces.length,
    id,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedRelatedThreadsQuery(input.trim());
    }, 180);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [input]);

  useEffect(() => {
    setSelectedRelatedThreadIds((current) => pruneRelatedThreadSelectionIds(current, relatedThreadCandidateById));
  }, [relatedThreadCandidateById]);

  useEffect(() => {
    if (!showNewConversationSetup || relatedThreadCandidates.length === 0) {
      setRelatedThreadResultsState({ visibleResults: [], searchResults: [] });
      return;
    }

    let cancelled = false;
    api
      .relatedConversationResults({
        sessions: relatedThreadCandidates,
        searchIndex: relatedThreadSearchIndex,
        summaries: relatedThreadSummaries,
        query: debouncedRelatedThreadsQuery,
        workspaceCwd: setupWorkspaceCwd,
        selectedRelatedThreadIds,
        limit: MAX_VISIBLE_RELATED_THREAD_RESULTS,
      })
      .then((result) => {
        if (!cancelled) {
          setRelatedThreadSearchError(null);
          setRelatedThreadResultsState({
            visibleResults: result.visibleResults,
            searchResults: result.searchResults,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRelatedThreadSearchError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedRelatedThreadsQuery,
    relatedThreadCandidates,
    relatedThreadSearchIndex,
    relatedThreadSummaries,
    selectedRelatedThreadIds,
    setupWorkspaceCwd,
    showNewConversationSetup,
  ]);

  useRelatedThreadHotkeys({
    enabled: showNewConversationSetup && !preparingRelatedThreadContext,
    results: visibleRelatedThreadResults,
    onToggle: toggleRelatedThreadSelection,
  });

  useEffect(() => {
    const missingSessionIds = selectMissingRelatedThreadSearchIndexIds({
      draft: showNewConversationSetup,
      inputText: debouncedRelatedThreadsQuery,
      selectedThreadIds: selectedRelatedThreadIds,
      candidateIds: relatedThreadCandidateIds,
      searchIndex: relatedThreadSearchIndex,
    });
    if (missingSessionIds.length === 0) {
      setRelatedThreadSearchLoading(false);
      setRelatedThreadSearchError(null);
      return;
    }

    let cancelled = false;
    setRelatedThreadSearchLoading(true);
    setRelatedThreadSearchError(null);

    api
      .sessionSearchIndex(missingSessionIds)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setRelatedThreadSearchIndex((current) => ({
          ...current,
          ...result.index,
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setRelatedThreadSearchError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) {
          setRelatedThreadSearchLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedRelatedThreadsQuery,
    relatedThreadCandidateIds,
    relatedThreadSearchIndex,
    selectedRelatedThreadIds.length,
    showNewConversationSetup,
  ]);

  useEffect(() => {
    const missingSessionIds = selectMissingRelatedThreadSummaryIds({
      draft: showNewConversationSetup,
      candidateIds: relatedThreadCandidateIds,
      summaries: relatedThreadSummaries,
    });
    if (missingSessionIds.length === 0) {
      return;
    }

    let cancelled = false;
    api
      .conversationSummaries(missingSessionIds)
      .then((result) => {
        if (cancelled || Object.keys(result.summaries).length === 0) {
          return;
        }

        setRelatedThreadSummaries((current) => ({ ...current, ...result.summaries }));
      })
      .catch(() => {
        // Summary metadata is an enhancement. Keep the picker usable on cache misses or generation failures.
      });

    return () => {
      cancelled = true;
    };
  }, [relatedThreadCandidateIds, relatedThreadSummaries, showNewConversationSetup]);

  useEffect(() => {
    const update = resolveRelatedThreadPreselectionUpdate({
      draft: showNewConversationSetup,
      query: debouncedRelatedThreadsQuery,
      selectedThreadIds: selectedRelatedThreadIds,
      autoSelectedThreadIds: autoSelectedRelatedThreadIds,
      searchResults: relatedThreadSearchResults,
      maxAutoSelections: MAX_RELATED_THREAD_SELECTIONS,
    });
    if (!update.changed) {
      return;
    }
    setSelectedRelatedThreadIds(update.selectedThreadIds);
    setAutoSelectedRelatedThreadIds(update.autoSelectedThreadIds);
  }, [
    autoSelectedRelatedThreadIds,
    debouncedRelatedThreadsQuery,
    relatedThreadSearchResults,
    selectedRelatedThreadIds,
    showNewConversationSetup,
  ]);

  useEffect(() => {
    if (draft) {
      setConversationCwdEditorOpen(false);
      setConversationCwdDraft('');
      setConversationCwdPickBusy(false);
      setConversationCwdBusy(false);
      setConversationCwdError(null);
      return;
    }

    if (!conversationCwdEditorOpen) {
      setConversationCwdDraft(currentCwd ?? '');
    }
  }, [conversationCwdEditorOpen, currentCwd, draft]);
  useEffect(() => {
    if (draft || !currentCwd) {
      setConversationWorkspaceGit(null);
      return;
    }

    let cancelled = false;
    setConversationWorkspaceGit(null);
    api
      .workspaceUncommittedDiff(currentCwd)
      .then((result) => {
        if (!cancelled) {
          setConversationWorkspaceGit(
            result.isGitRepo === false
              ? null
              : {
                  branch: result.branch,
                  changeCount: result.changeCount,
                  linesAdded: result.linesAdded,
                  linesDeleted: result.linesDeleted,
                },
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConversationWorkspaceGit(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentCwd, draft]);

  useEffect(() => {
    if (!draft || !draftCwdValue) {
      setDraftWorkspaceGit(null);
      return;
    }

    let cancelled = false;
    setDraftWorkspaceGit(null);
    api
      .workspaceUncommittedDiff(draftCwdValue)
      .then((result) => {
        if (!cancelled) {
          setDraftWorkspaceGit(
            result.isGitRepo === false
              ? null
              : {
                  branch: result.branch,
                  changeCount: result.changeCount,
                  linesAdded: result.linesAdded,
                  linesDeleted: result.linesDeleted,
                },
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDraftWorkspaceGit(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [draft, draftCwdValue]);

  const gitSummaryPresentation = useMemo(
    () => resolveConversationGitSummaryPresentation(draft ? draftWorkspaceGit : (liveSessionContext?.git ?? conversationWorkspaceGit)),
    [conversationWorkspaceGit, draft, draftWorkspaceGit, liveSessionContext?.git],
  );
  const hasGitSummary = gitSummaryPresentation.kind !== 'none';
  const showComposerMeta = shouldShowConversationComposerMeta({
    draft,
    draftCwdValue,
    sessionTokens,
    currentCwd,
    conversationCwdEditorOpen,
    conversationCwdError,
    branchLabel,
    hasGitSummary,
  });

  const lastUpsertedSessionRef = useRef<string>('');

  useEffect(() => {
    if (currentSessionMeta && currentSessionMeta.id === id) {
      // Avoid write-back loop: mergeConversationSessionMeta always creates a
      // new object, so comparing by reference won't work. Compare a stable
      // serialization of relevant fields instead.
      const key = `${currentSessionMeta.id}:${JSON.stringify(currentSessionMeta.deferredResumes ?? [])}:${JSON.stringify(currentSessionMeta.attachedContextDocs ?? [])}:${currentSessionMeta.isRunning ?? ''}:${currentSessionMeta.isLive ?? ''}:${currentSessionMeta.lastActivityAt ?? ''}:${currentSessionMeta.needsAttention ?? ''}`;
      if (lastUpsertedSessionRef.current !== key) {
        lastUpsertedSessionRef.current = key;
        sessionStore.upsert(currentSessionMeta);
      }
    }
  }, [currentSessionMeta, id]);

  useEffect(() => {
    if (!id) {
      setDeferredResumes([]);
      return;
    }

    if (currentSessionMeta?.id === id) {
      setDeferredResumes(currentSessionMeta.deferredResumes ?? []);
    }
  }, [currentSessionMeta, id]);

  const savedConversationSessionFile = currentSessionMeta?.file ?? visibleSessionDetail?.meta.file ?? null;
  const activityItems = visibleDesktopConversationState?.activity?.items ?? [];
  const activityBackgroundExecutions = useMemo(() => activityExecutions(activityItems), [activityItems]);
  const activityDeferredResumeItems = useMemo(() => activityDeferredResumes(activityItems), [activityItems]);
  const activityScheduledTaskItems = useMemo(() => activityScheduledTasks(activityItems), [activityItems]);
  const activityPendingQueue = useMemo(() => activityQueuedPrompts(activityItems), [activityItems]);
  const visiblePendingQueue = useMemo(
    () => (draft ? pendingQueue : mergeLiveAndActivityPendingQueueItems({ liveQueue: pendingQueue, activityQueue: activityPendingQueue })),
    [activityPendingQueue, draft, pendingQueue],
  );
  const visibleDeferredResumes = useMemo(() => {
    if (draft) return deferredResumes;
    return mergeCanonicalDeferredResumesWithActivity({ canonical: deferredResumes, activity: activityDeferredResumeItems });
  }, [activityDeferredResumeItems, deferredResumes, draft]);
  const deferredResumePresentation = useMemo(
    () =>
      resolveDeferredResumePresentationState({
        resumes: visibleDeferredResumes,
        nowMs: deferredResumeNowMs,
        isLiveSession,
        sessionFile: savedConversationSessionFile,
      }),
    [deferredResumeNowMs, isLiveSession, savedConversationSessionFile, visibleDeferredResumes],
  );
  const orderedDeferredResumes = deferredResumePresentation.orderedResumes;
  const deferredResumeScheduleTimerKey = useMemo(
    () => buildDeferredResumeScheduleTimerKey(orderedDeferredResumes),
    [orderedDeferredResumes],
  );
  const overdueScheduledDeferredResumeRefreshKey = useMemo(
    () => buildOverdueScheduledDeferredResumeRefreshKey(orderedDeferredResumes, deferredResumeNowMs),
    [deferredResumeNowMs, orderedDeferredResumes],
  );
  const visibleActiveConversationBackgroundExecutions = activityBackgroundExecutions.filter(
    (execution) => execution.id !== conversationRunId && isConversationExecutionActive(execution),
  );
  const backgroundExecutionIndicatorText = buildBackgroundExecutionIndicatorText(visibleActiveConversationBackgroundExecutions);
  const showActiveBackgroundRunDetails = showBackgroundRunDetails;
  const conversationScheduledTasks = useMemo(
    () => selectConversationScheduledTasks({ conversationId: id, activityTasks: activityScheduledTaskItems, tasks }),
    [activityScheduledTaskItems, id, tasks],
  );
  const scheduledTaskIndicatorText = buildScheduledTaskIndicatorText(conversationScheduledTasks);
  const runScheduledTaskFromShelf = useCallback(
    async (taskId: string) => {
      await api.runTaskNow(taskId);
      await desktopConversationRefresh().catch(() => {});
    },
    [desktopConversationRefresh],
  );

  useEffect(() => {
    if (!conversationScheduledTasks.some((task) => task.running)) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled) void desktopConversationRefresh().catch(() => {});
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [conversationScheduledTasks, desktopConversationRefresh]);

  const hasReadyDeferredResumes = deferredResumePresentation.hasReadyResumes;
  const deferredResumeAutoResumeKey = deferredResumePresentation.autoResumeKey;
  const deferredResumeIndicatorText = deferredResumePresentation.indicatorText;
  const lastConversationMessage = realMessages?.[realMessages.length - 1] ?? null;
  const conversationResumeState = useMemo(
    () =>
      getConversationResumeState({
        run: conversationRun,
        isLiveSession,
        lastMessage: lastConversationMessage,
      }),
    [conversationRun, isLiveSession, lastConversationMessage],
  );
  const draftMentionItems = useMemo(() => resolveMentionItems(input, mentionItems), [input, mentionItems]);
  const unattachedDraftMentionItems = useMemo(
    () => selectUnattachedMentionItems(draftMentionItems, attachedContextDocs),
    [attachedContextDocs, draftMentionItems],
  );
  const knownRunIds = useMemo(() => (runRecords.length > 0 ? new Set(runRecords.map((run) => run.runId)) : null), [runRecords]);
  const shouldLoadConversationRun = resolveShouldLoadConversationRun({
    conversationRunId,
    knownRunIds,
    draft,
    isLiveSession,
    stoppedMidTurn: didConversationStopMidTurn(lastConversationMessage),
    stoppedWithError: didConversationStopWithError(lastConversationMessage),
  });

  useEffect(() => {
    if (!conversationRunId || !shouldLoadConversationRun) {
      setConversationRun(null);
      return;
    }

    let cancelled = false;
    api
      .durableRun(conversationRunId)
      .then((data) => {
        if (!cancelled) {
          setConversationRun(data.run);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConversationRun(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationRunId, shouldLoadConversationRun, versions.runs]);

  const displayedPendingAssistantStatusLabel = resolveDisplayedConversationPendingStatusLabel({
    explicitLabel: pendingAssistantStatusLabel,
    draft,
    hasDraftPendingPrompt: Boolean(draftPendingPrompt),
    pendingPrompt: pendingInitialPrompt ?? draftPendingPrompt,
    isStreaming: stream.isStreaming,
    hasPendingInitialPrompt: Boolean(pendingInitialPrompt),
    hasPendingInitialPromptInFlight,
    isLiveSession,
    hasVisibleSessionDetail: Boolean(visibleSessionDetail),
  });
  const refetchConversationAttachments = useCallback(async () => {
    if (!id) {
      setConversationAttachments([]);
      return [] as ConversationAttachmentSummary[];
    }

    const lifecycle = conversationAttachmentsLifecycleRef.current;
    const requestId = lifecycle.latestRequestId + 1;
    lifecycle.latestRequestId = requestId;

    try {
      const data = await api.conversationAttachments(id);
      const currentLifecycle = conversationAttachmentsLifecycleRef.current;
      if (currentLifecycle.disposed || currentLifecycle.latestRequestId !== requestId) {
        return data.attachments;
      }

      setConversationAttachments(data.attachments);
      return data.attachments;
    } catch (error) {
      const currentLifecycle = conversationAttachmentsLifecycleRef.current;
      if (currentLifecycle.disposed || currentLifecycle.latestRequestId !== requestId) {
        return [] as ConversationAttachmentSummary[];
      }

      throw error;
    }
  }, [id]);
  const shouldFetchConversationAttachmentsNow = resolveShouldFetchConversationAttachmentsNow({
    draft,
    conversationId: id,
    drawingsPickerOpen,
  });

  const shouldFetchLiveSessionGitContext = shouldFetchLiveSessionGitContextNow({
    draft,
    conversationId: id,
    conversationLiveDecision,
    conversationBootstrapLoading,
    sessionLoading,
    isStreaming: stream.isStreaming,
    hasPendingInitialPrompt: Boolean(pendingInitialPrompt),
    pendingInitialPromptDispatching,
    hasPendingInitialPromptInFlight,
  });

  const refetchDeferredResumes = useCallback(async () => {
    if (!id) {
      setDeferredResumes([]);
      return [] as DeferredResumeSummary[];
    }

    const resumes = await loadDeferredResumesAfterConversationRefresh({
      refreshConversation: desktopConversationRefresh,
      loadDeferredResumes: () => api.deferredResumes(id),
    });
    setDeferredResumes(resumes);
    return resumes;
  }, [desktopConversationRefresh, id]);

  useEffect(() => {
    if (draft || !overdueScheduledDeferredResumeRefreshKey) {
      return;
    }

    const nowMs = Date.now();
    const lastRefresh = overdueDeferredResumeRefreshRef.current;
    if (lastRefresh?.key === overdueScheduledDeferredResumeRefreshKey && nowMs - lastRefresh.atMs < 5_000) {
      return;
    }

    overdueDeferredResumeRefreshRef.current = {
      key: overdueScheduledDeferredResumeRefreshKey,
      atMs: nowMs,
    };
    void refetchDeferredResumes().catch(() => {});
  }, [deferredResumeNowMs, draft, overdueScheduledDeferredResumeRefreshKey, refetchDeferredResumes]);

  const refetchLiveSessionContext = useCallback(async () => {
    if (draft || !id) {
      setLiveSessionContext(null);
      return null;
    }

    const lifecycle = liveSessionContextLifecycleRef.current;
    const requestId = lifecycle.latestRequestId + 1;
    lifecycle.latestRequestId = requestId;

    try {
      const next = await api.liveSessionContext(id);
      const currentLifecycle = liveSessionContextLifecycleRef.current;
      if (currentLifecycle.disposed || currentLifecycle.latestRequestId !== requestId) {
        return next;
      }

      setLiveSessionContext(next);
      return next;
    } catch {
      const currentLifecycle = liveSessionContextLifecycleRef.current;
      if (!currentLifecycle.disposed && currentLifecycle.latestRequestId === requestId) {
        setLiveSessionContext(null);
      }
      return null;
    }
  }, [draft, id]);

  const refetchLiveSessionContextIfReady = useCallback(async () => {
    if (!shouldFetchLiveSessionGitContext && !liveSessionContext) {
      return null;
    }

    return refetchLiveSessionContext();
  }, [liveSessionContext, refetchLiveSessionContext, shouldFetchLiveSessionGitContext]);

  const syncSavedWorkspacePaths = useCallback((workspacePaths: string[]) => {
    const normalized = syncSavedWorkspacePathValues(workspacePaths);
    setSavedWorkspacePaths(normalized);
    writeStoredWorkspacePaths(normalized);
    return normalized;
  }, []);

  const syncLocalSavedWorkspacePaths = useCallback(
    (workspacePaths: string[]) => {
      savedWorkspacePathsLifecycleRef.current.localWriteVersion += 1;
      return syncSavedWorkspacePaths(workspacePaths);
    },
    [syncSavedWorkspacePaths],
  );

  const refetchSavedWorkspacePaths = useCallback(async () => {
    if (!shouldRefetchSavedWorkspacePaths(draft)) {
      return [] as string[];
    }

    const lifecycle = savedWorkspacePathsLifecycleRef.current;
    const requestId = lifecycle.latestRequestId + 1;
    lifecycle.latestRequestId = requestId;
    const localWriteVersionAtStart = lifecycle.localWriteVersion;

    setSavedWorkspacePathsLoading(true);
    try {
      const workspacePaths = normalizeWorkspacePaths(await api.savedWorkspacePaths());
      const currentLifecycle = savedWorkspacePathsLifecycleRef.current;
      if (
        currentLifecycle.disposed ||
        currentLifecycle.latestRequestId !== requestId ||
        currentLifecycle.localWriteVersion !== localWriteVersionAtStart
      ) {
        return workspacePaths;
      }

      syncSavedWorkspacePaths(workspacePaths);
      return workspacePaths;
    } catch {
      return [] as string[];
    } finally {
      const currentLifecycle = savedWorkspacePathsLifecycleRef.current;
      if (!currentLifecycle.disposed && currentLifecycle.latestRequestId === requestId) {
        setSavedWorkspacePathsLoading(false);
      }
    }
  }, [draft, syncSavedWorkspacePaths]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    void refetchSavedWorkspacePaths();
  }, [draft, refetchSavedWorkspacePaths]);

  useInvalidateOnTopics(['attachments'], refetchConversationAttachments);
  useInvalidateOnTopics(['workspace'], refetchLiveSessionContextIfReady);
  useInvalidateOnTopics(['workspace'], refetchSavedWorkspacePaths);

  const resumeDeferredConversation = useCallback(async () => {
    if (!id || !savedConversationSessionFile) {
      throw new Error('Open the saved conversation before continuing deferred work.');
    }

    const resumeResult = await api.resumeConversation(id);
    if (resumeResult.conversationId && resumeResult.conversationId !== id) {
      ensureConversationTabOpen(resumeResult.conversationId);
      navigate(`/conversations/${resumeResult.conversationId}`);
      return;
    }

    setConfirmedLive(true);
    stream.reconnect();
    window.setTimeout(() => {
      void refetchDeferredResumes().catch(() => {});
    }, 200);
  }, [id, navigate, refetchDeferredResumes, savedConversationSessionFile, stream.reconnect]);

  useEffect(() => {
    setConversationAttachments([]);
  }, [draft, id]);

  useEffect(() => {
    if (!shouldFetchConversationAttachmentsNow) {
      return;
    }

    setDrawingsError(null);
    void refetchConversationAttachments().catch((error) => {
      setDrawingsError(error instanceof Error ? error.message : String(error));
    });
  }, [refetchConversationAttachments, shouldFetchConversationAttachmentsNow]);

  useEffect(() => {
    if (conversationLiveDecision === null) {
      setLiveSessionContext(null);
      return;
    }

    if (!shouldFetchLiveSessionGitContext) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refetchLiveSessionContext().catch(() => {});
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [conversationLiveDecision, refetchLiveSessionContext, shouldFetchLiveSessionGitContext]);

  useEffect(() => {
    if (draft || !id) {
      return;
    }

    function handleOpenDrawingPicker() {
      setDrawingsPickerOpen(true);
      setDrawingsError(null);
    }

    window.addEventListener(DRAWING_PICKER_OPEN_COMMAND_EVENT, handleOpenDrawingPicker);
    return () => {
      window.removeEventListener(DRAWING_PICKER_OPEN_COMMAND_EVENT, handleOpenDrawingPicker);
    };
  }, [draft, id]);

  useEffect(() => {
    if (!id) {
      setDeferredResumes([]);
      return;
    }

    if (initialDeferredResumeState && skippedInitialDeferredResumeLocationKeyRef.current !== location.key) {
      skippedInitialDeferredResumeLocationKeyRef.current = location.key;
      setDeferredResumes(initialDeferredResumeState);
      return;
    }

    void refetchDeferredResumes().catch(() => {});
  }, [id, initialDeferredResumeState, location.key, refetchDeferredResumes]);

  useEffect(() => {
    if (!deferredResumeScheduleTimerKey) {
      setShowDeferredResumeDetails(false);
      return;
    }

    setDeferredResumeNowMs(Date.now());
    const intervalHandle = window.setInterval(() => {
      setDeferredResumeNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [deferredResumeScheduleTimerKey]);

  useEffect(() => {
    if (
      !shouldAutoResumeDeferredResumes({
        autoResumeKey: deferredResumeAutoResumeKey,
        lastAttemptedKey: attemptedDeferredResumeAutoResumeKeyRef.current,
        draft,
        deferredResumesBusy,
        resumeConversationBusy,
      })
    ) {
      return;
    }

    attemptedDeferredResumeAutoResumeKeyRef.current = deferredResumeAutoResumeKey;
    void resumeDeferredConversation().catch((error) => {
      console.error('Deferred resume auto-resume failed:', error);
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
      addNotification({
        type: 'error',
        message: 'Auto-resume failed',
        details: error instanceof Error ? error.message : String(error),
        source: 'core',
      });
    });
  }, [
    deferredResumeAutoResumeKey,
    deferredResumesBusy,
    draft,
    isLiveSession,
    resumeConversationBusy,
    resumeDeferredConversation,
    showNotice,
  ]);

  // Auto-resize textarea. Schedule the measurement once per frame so typing
  // does not force multiple synchronous layouts against a large transcript.
  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      return;
    }

    const previousScrollTop = el.scrollTop;
    const selectionEnd = el.selectionEnd ?? el.value.length;
    const shouldKeepCaretVisible = document.activeElement === el && selectionEnd >= el.value.length;

    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > nextHeight ? 'auto' : 'hidden';

    // iOS Safari can leave the caret below the visible textarea after the
    // auto-height reset, making lines appear only after another character is
    // typed. Keep normal in-field scrolling stable, but pin typing-at-end to
    // the bottom so newly inserted lines are immediately editable.
    el.scrollTop = shouldKeepCaretVisible ? el.scrollHeight : previousScrollTop;
  }, []);

  const scheduleComposerResize = useCallback(() => {
    if (typeof window === 'undefined' || composerResizeFrameRef.current !== null) {
      return;
    }

    composerResizeFrameRef.current = window.requestAnimationFrame(() => {
      composerResizeFrameRef.current = null;
      resizeComposer();
    });
  }, [resizeComposer]);

  const rememberComposerInput = useCallback(
    (value: string, scopeId: string | null = composerHistoryScopeId) => {
      const nextHistory = appendComposerHistory(scopeId, value);
      setComposerHistory(nextHistory);
      setComposerHistoryIndex(null);
      composerHistoryDraftRef.current = '';
    },
    [composerHistoryScopeId],
  );

  const composerController = useComposerController({
    inputRef: latestInputRef,
    textareaRef,
    selectionRef: composerSelectionRef,
    setInput,
    scheduleResize: scheduleComposerResize,
    onTextInserted: () => {
      composerMenuStateRef.current?.resetMenus();
    },
  });
  const {
    rememberSelection: rememberComposerSelection,
    moveCaretToEnd: moveComposerCaretToEnd,
    insertText: insertTextIntoComposer,
    appendText: appendTextToComposer,
  } = composerController;

  const handleComposerSlashMenuCommand = useCallback(
    async (slashInput: string): Promise<boolean> => {
      const parsed = parseConversationSlashCommand(slashInput);
      if (!parsed) {
        return false;
      }

      await submitComposer();
      return true;
    },
    [submitComposer],
  );

  const handleComposerSlashMenuSelect = useCallback(
    async (item: SlashMenuItem) => {
      composerController.setText(item.insertText);
    },
    [composerController],
  );

  const handleComposerMentionSelect = useCallback(
    async (id: string, currentInput: string) => {
      composerController.setText(currentInput.replace(/@[-\w./-]*$/, `${id} `));
    },
    [composerController],
  );

  const composerMenus = useConversationComposerMenus({
    input,
    slashItems,
    mentionItems,
    models,
    onSlashCommandCommit: handleComposerSlashMenuCommand,
    onSlashMenuSelect: handleComposerSlashMenuSelect,
    onMentionSelect: handleComposerMentionSelect,
    onModelSelect: async (selectedModelId) => {
      await selectModel(selectedModelId);
    },
    onClearComposer: composerController.clear,
  });

  const {
    showModelPicker,
    showSlash,
    showMention,
    slashIdx,
    mentionIdx,
    modelIdx,
    modelItems,
    modelQuery,
    mentionQuery,
    handleMenuKeyDown: handleComposerMenuKeyDown,
    resetMenus: resetComposerMenus,
    setModelIdx,
  } = composerMenus;

  composerMenuStateRef.current = composerMenus;

  useWorkspaceComposerEvents({
    input,
    textareaRef,
    composer: composerController,
    resetMenus: resetComposerMenus,
  });

  useEffect(() => {
    if (!pendingAskUserQuestion || input.length > 0 || attachments.length > 0 || drawingAttachments.length > 0) {
      return;
    }

    moveComposerCaretToEnd();
  }, [attachments.length, drawingAttachments.length, input.length, moveComposerCaretToEnd, pendingAskUserQuestionKey]);

  const submitAskUserQuestion = useCallback(
    async (presentation: AskUserQuestionPresentation, answers: AskUserQuestionAnswers) => {
      const textToSend = buildAskUserQuestionReplyText(presentation, answers).trim();
      if (!textToSend) {
        return;
      }

      if (!id) {
        showNotice('danger', 'Question replies require an existing conversation.', 4000);
        return;
      }

      const requestedBehavior = isLiveSession ? defaultComposerBehavior : undefined;
      const queuedBehavior = normalizeConversationComposerBehavior(requestedBehavior, allowQueuedPrompts);

      try {
        if (isLiveSession) {
          await streamSend(textToSend, queuedBehavior);
          window.setTimeout(() => {
            scrollToBottom();
          }, 50);
          return;
        }

        if (!visibleSessionDetail) {
          showNotice('danger', 'Conversation is still loading. Try again in a moment.', 4000);
          return;
        }

        await api.resumeSession(visibleSessionDetail.meta.file, visibleSessionDetail.meta.cwd);
        setConfirmedLive(true);
        streamReconnect();
        await streamSend(textToSend, queuedBehavior);
        window.setTimeout(() => {
          scrollToBottom();
        }, 50);
      } catch (error) {
        showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
        throw error;
      }
    },
    [
      allowQueuedPrompts,
      defaultComposerBehavior,
      id,
      isLiveSession,
      scrollToBottom,
      showNotice,
      streamReconnect,
      streamSend,
      visibleSessionDetail,
    ],
  );

  const composerQuestionAnsweredCount = countAnsweredAskUserQuestions(pendingAskUserQuestion?.presentation, composerQuestionAnswers);
  const composerQuestionCanSubmit = pendingAskUserQuestion
    ? isAskUserQuestionComplete(pendingAskUserQuestion.presentation, composerQuestionAnswers)
    : false;
  const composerQuestionRemainingCount = pendingAskUserQuestion
    ? Math.max(0, pendingAskUserQuestion.presentation.questions.length - composerQuestionAnsweredCount)
    : 0;

  const activateComposerQuestion = useCallback(
    (index: number) => {
      if (!pendingAskUserQuestion) {
        return;
      }

      const nextIndex = Math.max(0, Math.min(index, pendingAskUserQuestion.presentation.questions.length - 1));
      const nextQuestion = pendingAskUserQuestion.presentation.questions[nextIndex];
      const nextOptionIndex = resolveAskUserQuestionDefaultOptionIndex(nextQuestion, composerQuestionAnswers);
      setComposerQuestionIndex(nextIndex);
      setComposerQuestionOptionIndex(nextOptionIndex >= 0 ? nextOptionIndex : 0);
      moveComposerCaretToEnd();
    },
    [composerQuestionAnswers, moveComposerCaretToEnd, pendingAskUserQuestion],
  );

  const advanceComposerQuestionAfterAnswer = useCallback(
    (questionIndex: number, nextAnswers: AskUserQuestionAnswers) => {
      if (!pendingAskUserQuestion) {
        return;
      }

      const nextQuestionIndex = questionIndex + 1;
      if (nextQuestionIndex < pendingAskUserQuestion.presentation.questions.length) {
        const nextQuestion = pendingAskUserQuestion.presentation.questions[nextQuestionIndex];
        const nextOptionIndex = resolveAskUserQuestionDefaultOptionIndex(nextQuestion, nextAnswers);
        setComposerQuestionIndex(nextQuestionIndex);
        setComposerQuestionOptionIndex(nextOptionIndex >= 0 ? nextOptionIndex : 0);
      }

      moveComposerCaretToEnd();
    },
    [moveComposerCaretToEnd, pendingAskUserQuestion],
  );

  const handleComposerQuestionOptionSelect = useCallback(
    (questionIndex: number, optionIndex: number) => {
      if (!pendingAskUserQuestion || composerQuestionSubmitting) {
        return;
      }

      const question = pendingAskUserQuestion.presentation.questions[questionIndex];
      const option = question?.options[optionIndex];
      if (!question || !option) {
        return;
      }

      setComposerQuestionOptionIndex(optionIndex);

      const { nextAnswers, selectedValues } = resolveAskUserQuestionAnswerSelection({
        question,
        option,
        answers: composerQuestionAnswers,
      });
      setComposerQuestionAnswers(nextAnswers);
      if (shouldAdvanceAskUserQuestionAfterSelection(question, selectedValues)) {
        advanceComposerQuestionAfterAnswer(questionIndex, nextAnswers);
      }
    },
    [advanceComposerQuestionAfterAnswer, composerQuestionAnswers, composerQuestionSubmitting, pendingAskUserQuestion],
  );

  const submitComposerQuestionIfReady = useCallback(async () => {
    if (!pendingAskUserQuestion || !composerQuestionCanSubmit || composerQuestionSubmitting) {
      return false;
    }

    setComposerQuestionSubmitting(true);
    try {
      await submitAskUserQuestion(pendingAskUserQuestion.presentation, composerQuestionAnswers);
      clearComposerQuestionAnswers();
      return true;
    } finally {
      setComposerQuestionSubmitting(false);
    }
  }, [
    clearComposerQuestionAnswers,
    composerQuestionAnswers,
    composerQuestionCanSubmit,
    composerQuestionSubmitting,
    pendingAskUserQuestion,
    submitAskUserQuestion,
  ]);

  const navigateComposerHistory = useCallback(
    (direction: 'older' | 'newer') => {
      const next = resolveComposerHistoryNavigation({
        direction,
        history: composerHistory,
        currentIndex: composerHistoryIndex,
        currentInput: input,
        draftInput: composerHistoryDraftRef.current,
      });
      if (!next) {
        return false;
      }

      setComposerHistoryIndex(next.nextIndex);
      composerController.setText(next.nextInput, { focus: false });
      composerHistoryDraftRef.current = next.nextDraftInput;
      moveComposerCaretToEnd();
      return true;
    },
    [composerController, composerHistory, composerHistoryIndex, input, moveComposerCaretToEnd],
  );

  useLayoutEffect(() => {
    scheduleComposerResize();
  }, [input, scheduleComposerResize]);

  useEffect(
    () => () => {
      if (composerResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(composerResizeFrameRef.current);
        composerResizeFrameRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
    };
  }, []);

  // Scroll tracking
  const handleScroll = useCallback(() => {
    syncScrollStateFromDom();

    const el = scrollRef.current;
    if (!el) {
      return;
    }

    if (
      scrollPrefetchUserIntentRef.current &&
      historicalHasOlderBlocks &&
      !sessionLoading &&
      el.scrollTop <= HISTORICAL_PREFETCH_SCROLL_THRESHOLD_PX
    ) {
      const now = performance.now();
      if (now - lastHistoricalPrefetchRequestedAtRef.current < HISTORICAL_PREFETCH_COOLDOWN_MS) {
        return;
      }
      lastHistoricalPrefetchRequestedAtRef.current = now;
      loadOlderMessages();
    }
  }, [historicalHasOlderBlocks, loadOlderMessages, sessionLoading, syncScrollStateFromDom]);

  useEffect(() => {
    scrollPrefetchUserIntentRef.current = false;
    lastHistoricalPrefetchRequestedAtRef.current = 0;
  }, [id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const markUserScrollIntent = () => {
      setAutoAnchorTranscriptTail(false);
      scrollPrefetchUserIntentRef.current = true;
    };
    el.addEventListener('wheel', markUserScrollIntent, { passive: true });
    el.addEventListener('touchstart', markUserScrollIntent, { passive: true });
    el.addEventListener('pointerdown', markUserScrollIntent, { passive: true });
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', markUserScrollIntent);
      el.removeEventListener('touchstart', markUserScrollIntent);
      el.removeEventListener('pointerdown', markUserScrollIntent);
      el.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  useEscapeAbortStream({
    isStreaming: composerRunState.streamControlsActive,
    abort: stopStreamAndRestoreQueuedPrompts,
    hasBlockingOverlay: () => hasBlockingOverlayOpen(hasBlockingConversationOverlay),
  });

  // Forked/new conversations with a queued initial prompt should stay pinned to
  // the bottom only until that queued user block lands and the assistant starts
  // its response. After that, let the transcript stay put so the response can be
  // read from the top while it streams.
  useLayoutEffect(() => {
    if (!id || pinnedInitialPromptScrollSessionIdRef.current !== id || !scrollRef.current) {
      return;
    }

    const tailBlock = realMessages?.[realMessages.length - 1];
    const tailKey = getConversationTailBlockKey(tailBlock);
    if (pinnedInitialPromptTailKeyRef.current) {
      if (tailKey && tailKey !== pinnedInitialPromptTailKeyRef.current) {
        pinnedInitialPromptScrollSessionIdRef.current = null;
        pinnedInitialPromptTailKeyRef.current = null;
        return;
      }
    } else if (tailBlock?.type === 'user' && tailKey) {
      pinnedInitialPromptTailKeyRef.current = tailKey;
    }

    const pinToBottom = () => {
      scrollToBottom();
    };

    pinToBottom();
    const animationFrame = window.requestAnimationFrame(pinToBottom);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [id, realMessages, scrollToBottom]);

  // Focus input on navigation
  useEffect(() => {
    textareaRef.current?.focus();
  }, [id]);

  useEffect(() => {
    const shouldFocus =
      location.state && typeof location.state === 'object' && 'focusComposer' in location.state && location.state.focusComposer === true;
    if (!shouldFocus) {
      return;
    }

    const focusComposer = () => {
      const composer = textareaRef.current;
      if (!composer || composer.disabled) {
        return;
      }
      composer.focus();
      const end = composer.value.length;
      composer.selectionStart = end;
      composer.selectionEnd = end;
    };

    focusComposer();
    const frame = window.requestAnimationFrame(focusComposer);
    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.state]);

  const focusComposerFromTranscriptBackground = useCallback(() => {
    const composer = textareaRef.current;
    if (!composer || composer.disabled) {
      return;
    }

    composer.focus();
  }, []);

  useEffect(() => {
    if (prevStreamingRef.current && !stream.isStreaming) {
      if (pinnedInitialPromptScrollSessionIdRef.current === id) {
        pinnedInitialPromptScrollSessionIdRef.current = null;
        pinnedInitialPromptTailKeyRef.current = null;
      }
    }
    prevStreamingRef.current = stream.isStreaming;
  }, [id, stream.isStreaming]);

  // Jump to message by index
  const jumpToMessage = useCallback(
    (index: number) => {
      const el = scrollRef.current?.querySelector(`#msg-${index}`);
      if (el) {
        pendingJumpMessageIndexRef.current = null;
        setRequestedFocusMessageIndex(null);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      pendingJumpMessageIndexRef.current = index;
      setRequestedFocusMessageIndex(index);
      if (index < historicalBlockOffset) {
        loadOlderMessages(index);
      }
    },
    [historicalBlockOffset, loadOlderMessages],
  );

  useLayoutEffect(() => {
    const pendingIndex = pendingJumpMessageIndexRef.current;
    if (pendingIndex === null || pendingIndex < historicalBlockOffset) {
      return;
    }

    const el = scrollRef.current?.querySelector(`#msg-${pendingIndex}`);
    if (!el) {
      return;
    }

    pendingJumpMessageIndexRef.current = null;
    setRequestedFocusMessageIndex(null);
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [historicalBlockOffset, realMessages]);

  useEffect(() => {
    if (!isEditingTitle) {
      return;
    }

    window.requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    });
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingTitle) {
      return;
    }

    setTitleDraft(title);
  }, [title, isEditingTitle]);

  const beginTitleEdit = useCallback(() => {
    if (draft || !id || titleSaving || isEditingTitle || conversationCwdEditorOpen || conversationCwdBusy || conversationCwdPickBusy) {
      return;
    }

    if (conversationNeedsTakeover) {
      showNotice('danger', 'Take over this conversation to rename it.', 4000);
      return;
    }

    setConversationCwdEditorOpen(false);
    setConversationCwdError(null);
    setTitleDraft(title === NEW_CONVERSATION_TITLE ? '' : title);
    setIsEditingTitle(true);
  }, [
    conversationCwdBusy,
    conversationCwdEditorOpen,
    conversationCwdPickBusy,
    conversationNeedsTakeover,
    draft,
    id,
    isEditingTitle,
    title,
    titleSaving,
    showNotice,
  ]);

  const cancelTitleEdit = useCallback(() => {
    setIsEditingTitle(false);
    setTitleDraft(title);
  }, [title]);

  const saveTitleEdit = useCallback(async () => {
    if (draft || !id) {
      return;
    }

    const nextTitle = titleDraft.trim();
    if (!nextTitle) {
      showNotice('danger', 'Conversation title is required.');
      return;
    }

    if (nextTitle === title) {
      setIsEditingTitle(false);
      return;
    }

    await renameConversationTo(nextTitle);
  }, [draft, id, renameConversationTo, showNotice, title, titleDraft]);

  const submitConversationCwdChange = useCallback(
    async (nextCwdOverride?: string | null) => {
      if (draft || !id || conversationCwdBusy) {
        return;
      }

      if (!ensureConversationCanControl('change its working directory')) {
        return;
      }

      if (stream.isStreaming) {
        showNotice('danger', 'Stop the current response before changing the working directory.', 4000);
        return;
      }

      const nextCwd = nextCwdOverride === null ? null : (nextCwdOverride ?? conversationCwdDraft).trim();
      if (nextCwd !== null && !nextCwd) {
        setConversationCwdError('Enter a directory path.');
        return;
      }

      setConversationCwdBusy(true);
      setConversationCwdError(null);

      try {
        const result = await api.changeConversationCwd(id, nextCwd, currentSurfaceId);
        setConversationCwdEditorOpen(false);
        setConversationCwdDraft(result.cwd ?? '');

        if (!result.changed || result.id === id) {
          stream.reconnect();
          void refetchLiveSessionContext();
          return;
        }

        ensureConversationTabOpen(result.id);
        closeConversationTab(id);
        navigate(`/conversations/${result.id}`);
      } catch (error) {
        setConversationCwdError(formatConversationCwdError(error));
      } finally {
        setConversationCwdBusy(false);
      }
    },
    [
      conversationCwdBusy,
      conversationCwdDraft,
      currentSurfaceId,
      draft,
      ensureConversationCanControl,
      id,
      navigate,
      refetchLiveSessionContext,
      showNotice,
      stream.isStreaming,
      stream.reconnect,
    ],
  );

  const pickConversationCwd = useCallback(async () => {
    if (draft || !id || conversationCwdPickBusy || conversationCwdBusy) {
      return;
    }

    if (!ensureConversationCanControl('change its working directory')) {
      return;
    }

    setConversationCwdPickBusy(true);
    setConversationCwdError(null);

    try {
      const result = await api.pickFolder({
        cwd: conversationCwdDraft.trim() || (currentCwdLabel === 'Chat' ? undefined : currentCwd || undefined),
        prompt: 'Choose a working directory',
      });
      if (result.cancelled || !result.path) {
        return;
      }

      const nextSavedWorkspacePaths = syncLocalSavedWorkspacePaths([
        result.path,
        ...savedWorkspacePaths.filter((path) => path !== result.path),
      ]);
      void api.setSavedWorkspacePaths(nextSavedWorkspacePaths);
      setConversationCwdDraft(result.path);
      setConversationCwdEditorOpen(true);
      await submitConversationCwdChange(result.path);
    } catch (error) {
      setConversationCwdError(error instanceof Error ? error.message : 'Could not choose a folder.');
    } finally {
      setConversationCwdPickBusy(false);
    }
  }, [
    conversationCwdBusy,
    conversationCwdDraft,
    conversationCwdPickBusy,
    currentCwd,
    currentCwdLabel,
    draft,
    ensureConversationCanControl,
    id,
    savedWorkspacePaths,
    submitConversationCwdChange,
    syncLocalSavedWorkspacePaths,
  ]);

  const pickLiveSetupConversationCwd = useCallback(async () => {
    if (draft || !id || conversationCwdPickBusy || conversationCwdBusy) {
      return;
    }

    if (!ensureConversationCanControl('change its working directory')) {
      return;
    }

    setConversationCwdPickBusy(true);
    setConversationCwdError(null);

    try {
      const result = await api.pickFolder({
        cwd: currentCwd || undefined,
        prompt: 'Choose a workspace folder',
      });
      if (result.cancelled || !result.path) {
        return;
      }

      const nextSavedWorkspacePaths = syncLocalSavedWorkspacePaths([
        result.path,
        ...savedWorkspacePaths.filter((path) => path !== result.path),
      ]);
      void api.setSavedWorkspacePaths(nextSavedWorkspacePaths);
      await submitConversationCwdChange(result.path);
    } catch (error) {
      setConversationCwdError(error instanceof Error ? error.message : 'Could not choose a folder.');
    } finally {
      setConversationCwdPickBusy(false);
    }
  }, [
    conversationCwdBusy,
    conversationCwdPickBusy,
    currentCwd,
    draft,
    ensureConversationCanControl,
    id,
    savedWorkspacePaths,
    syncLocalSavedWorkspacePaths,
    submitConversationCwdChange,
  ]);

  const beginConversationCwdEdit = useCallback(() => {
    if (draft || !id || conversationCwdBusy) {
      return;
    }

    if (!ensureConversationCanControl('change its working directory')) {
      return;
    }

    if (stream.isStreaming) {
      showNotice('danger', 'Stop the current response before changing the working directory.', 4000);
      return;
    }

    setConversationCwdDraft(currentCwdLabel === 'Chat' ? '' : (currentCwd ?? ''));
    setConversationCwdError(null);
    setConversationCwdEditorOpen(true);
  }, [conversationCwdBusy, currentCwd, currentCwdLabel, draft, ensureConversationCanControl, id, showNotice, stream.isStreaming]);

  const cancelConversationCwdEdit = useCallback(() => {
    setConversationCwdDraft(currentCwdLabel === 'Chat' ? '' : (currentCwd ?? ''));
    setConversationCwdError(null);
    setConversationCwdEditorOpen(false);
  }, [currentCwd, currentCwdLabel]);

  useEffect(() => {
    setExtensionCommandContext(
      'conversation.canRename',
      !draft &&
        Boolean(id) &&
        !isEditingTitle &&
        !titleSaving &&
        !conversationNeedsTakeover &&
        !conversationCwdEditorOpen &&
        !conversationCwdBusy &&
        !conversationCwdPickBusy,
    );
    setExtensionCommandContext('conversation.titleEditorOpen', isEditingTitle);
    setExtensionCommandContext('conversation.titleEditorBusy', titleSaving);
    return () => {
      setExtensionCommandContext('conversation.canRename', null);
      setExtensionCommandContext('conversation.titleEditorOpen', null);
      setExtensionCommandContext('conversation.titleEditorBusy', null);
    };
  }, [
    conversationCwdBusy,
    conversationCwdEditorOpen,
    conversationCwdPickBusy,
    conversationNeedsTakeover,
    draft,
    id,
    isEditingTitle,
    titleSaving,
  ]);

  useEffect(() => {
    setExtensionCommandContext(
      'conversation.canEditCwd',
      !draft && Boolean(id) && !conversationCwdEditorOpen && !conversationCwdBusy && !conversationCwdPickBusy && !stream.isStreaming,
    );
    setExtensionCommandContext('conversation.cwdEditorOpen', conversationCwdEditorOpen);
    setExtensionCommandContext('conversation.cwdEditorBusy', conversationCwdBusy || conversationCwdPickBusy);
    return () => {
      setExtensionCommandContext('conversation.canEditCwd', null);
      setExtensionCommandContext('conversation.cwdEditorOpen', null);
      setExtensionCommandContext('conversation.cwdEditorBusy', null);
    };
  }, [conversationCwdBusy, conversationCwdEditorOpen, conversationCwdPickBusy, draft, id, stream.isStreaming]);

  useEffect(() => {
    if (
      !shouldAutoDispatchPendingInitialPrompt({
        draft,
        conversationId: id,
        hasPendingInitialPrompt: Boolean(pendingInitialPrompt),
        pendingInitialPromptDispatching,
        hasStreamSnapshot: stream.hasSnapshot,
        hasTranscriptMessages: actualTranscriptMessageCount > 0,
      })
    ) {
      return;
    }

    if (
      !shouldClaimPendingInitialPromptForSession({
        conversationId: id,
        prompt: pendingInitialPrompt,
        inFlightSessionId: pendingInitialPromptSessionIdRef.current,
        failedSessionId: pendingInitialPromptFailureSessionIdRef.current,
      })
    ) {
      return;
    }

    const conversationId = id;
    const promptToClaim = pendingInitialPrompt;
    if (!conversationId || !promptToClaim) {
      return;
    }

    const keepsStoredPromptDuringDispatch = shouldKeepStoredPendingInitialPromptDuringDispatch(promptToClaim);
    const claimedInitialPrompt = keepsStoredPromptDuringDispatch ? promptToClaim : consumePendingConversationPrompt(conversationId);
    if (!claimedInitialPrompt) {
      setPendingInitialPrompt(null);
      return;
    }

    pendingInitialPromptSessionIdRef.current = conversationId;
    pinnedInitialPromptScrollSessionIdRef.current = conversationId;
    pinnedInitialPromptTailKeyRef.current = null;

    if (keepsStoredPromptDuringDispatch) {
      setPendingConversationPromptDispatching(conversationId, true);
    } else {
      setPendingInitialPrompt(null);
    }

    void (async () => {
      const preparedInitialPrompt = claimedInitialPrompt;
      try {
        const sendResult = await stream.send(
          preparedInitialPrompt.text,
          normalizeConversationComposerBehavior(preparedInitialPrompt.behavior, allowQueuedPrompts),
          preparedInitialPrompt.images,
          preparedInitialPrompt.attachmentRefs,
          preparedInitialPrompt.contextMessages,
          normalizePendingRelatedConversationIds(preparedInitialPrompt),
        );
        for (const warning of sendResult?.relatedConversationPointerWarnings ?? []) {
          showNotice('danger', warning, 5000);
        }
        pendingInitialPromptSessionIdRef.current = null;
      } catch (error) {
        pendingInitialPromptSessionIdRef.current = null;
        pendingInitialPromptFailureSessionIdRef.current = conversationId;
        pinnedInitialPromptScrollSessionIdRef.current = null;
        pinnedInitialPromptTailKeyRef.current = null;
        persistPendingConversationPrompt(conversationId, preparedInitialPrompt);
        setPendingConversationPromptDispatching(conversationId, false);
        setPendingInitialPrompt(preparedInitialPrompt);
        persistForkPromptDraft(conversationId, preparedInitialPrompt.text);
        console.error('Initial prompt failed:', error);
        showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
        addNotification({
          type: 'error',
          message: 'Initial prompt failed',
          details: error instanceof Error ? error.message : String(error),
          source: 'core',
        });
      }
    })();
  }, [
    draft,
    id,
    pendingInitialPrompt,
    pendingInitialPromptDispatching,
    allowQueuedPrompts,
    actualTranscriptMessageCount,
    realMessages?.length,
    stream.hasSnapshot,
    stream.send,
    showNotice,
  ]);

  const ensureConversationIsLive = useCallback(
    async (actionDescription = 'continue', options?: { forceResume?: boolean }) => {
      if (!id) {
        throw new Error('Conversation unavailable.');
      }

      if (isLiveSession && !options?.forceResume) {
        return id;
      }

      const resumeResult = await api.resumeConversation(id);
      if (!resumeResult.live) {
        throw new Error(`This conversation could not ${actionDescription}.`);
      }

      if (resumeResult.conversationId === id) {
        setConfirmedLive(true);
        streamReconnect();
      }

      return resumeResult.conversationId;
    },
    [id, isLiveSession, streamReconnect, streamTakeover],
  );

  const rewindConversationFromMessage = useCallback(
    async (messageIndex: number) => {
      const actionState = visibleTranscriptActionStateRef.current;
      const actionMessages = actionState?.conversationId === id && actionState.messages.length > 0 ? actionState.messages : realMessages;
      const actionMessageIndexOffset =
        actionState?.conversationId === id && actionState.messages.length > 0 ? actionState.historicalBlockOffset : messageIndexOffset;
      if (!id || !actionMessages) {
        return;
      }

      const localMessageIndex = messageIndex - actionMessageIndexOffset;
      if (localMessageIndex < 0 || localMessageIndex >= actionMessages.length) {
        showNotice('danger', 'Load the relevant part of the conversation before rewinding from it.');
        return;
      }

      try {
        const liveConversationId = await ensureConversationIsLive('be rewound');
        const clickedBlock = actionMessages[localMessageIndex];
        let target: { entryId: string; beforeEntry: boolean; promptDraft: string | null } | null = null;

        if (clickedBlock?.type === 'text' || clickedBlock?.type === 'user') {
          let entryId = resolveSessionEntryIdFromBlockId(clickedBlock.id);
          if (!entryId) {
            const detail = await api.sessionDetail(liveConversationId, {
              tailBlocks: Math.max(realMessages.length, 1),
            });
            entryId = resolveBranchEntryIdFromSessionDetailResult(clickedBlock, messageIndex, detail);
          }
          if (entryId) {
            target = resolveRewindTargetFromResolvedEntry(actionMessages, localMessageIndex, entryId);
          }
        }

        if (!target) {
          const entries = await api.forkEntries(liveConversationId);
          target = resolveRewindTargetForMessage(actionMessages, localMessageIndex, entries);
        }
        if (!target) {
          throw new Error('No forkable message found for that point in the conversation.');
        }

        if (!ensureConversationCanControl('rewind from this message')) {
          return;
        }

        const forked = await retryLiveSessionActionAfterTakeover({
          attemptAction: () =>
            api.forkSession(
              liveConversationId,
              target.entryId,
              {
                preserveSource: true,
                beforeEntry: target.beforeEntry,
                branchKind: 'rewind',
              },
              currentSurfaceId,
            ),
          takeOverSessionControl: () => streamTakeover(),
        });
        const { newSessionId } = forked;
        primeForkedConversationOpenCaches(forked);
        if (target.promptDraft) {
          persistForkPromptDraft(newSessionId, target.promptDraft);
        }
        window.dispatchEvent(
          new CustomEvent('pa:companion-chat-open', {
            detail: { conversationId: newSessionId },
          }),
        );
      } catch (error) {
        showNotice('danger', formatConversationMessageActionFailure('Rewind', error));
      }
    },
    [
      currentSurfaceId,
      ensureConversationCanControl,
      ensureConversationIsLive,
      id,
      messageIndexOffset,
      primeForkedConversationOpenCaches,
      realMessages,
      showNotice,
      streamTakeover,
    ],
  );

  const editConversationFromUserMessage = useCallback(
    async (messageIndex: number, text: string) => {
      const actionState = visibleTranscriptActionStateRef.current;
      const actionMessages = actionState?.conversationId === id && actionState.messages.length > 0 ? actionState.messages : realMessages;
      const actionMessageIndexOffset =
        actionState?.conversationId === id && actionState.messages.length > 0 ? actionState.historicalBlockOffset : messageIndexOffset;
      if (!id || !actionMessages) {
        return;
      }

      const editedText = text.trim();
      if (!editedText) {
        showNotice('danger', 'Edited prompt cannot be empty.');
        return;
      }

      const localMessageIndex = messageIndex - actionMessageIndexOffset;
      if (localMessageIndex < 0 || localMessageIndex >= actionMessages.length) {
        showNotice('danger', 'Load the relevant part of the conversation before editing it.');
        return;
      }

      const clickedBlock = actionMessages[localMessageIndex];
      if (clickedBlock?.type !== 'user') {
        return;
      }

      try {
        const liveConversationId = await ensureConversationIsLive('edit this prompt');
        let entryId = resolveSessionEntryIdFromBlockId(clickedBlock.id);
        if (!entryId) {
          const detail = await api.sessionDetail(liveConversationId, {
            tailBlocks: Math.max(realMessages.length, 1),
          });
          entryId = resolveBranchEntryIdFromSessionDetailResult(clickedBlock, messageIndex, detail);
        }
        if (!entryId) {
          throw new Error('The selected prompt is not ready to edit yet. Try again in a moment.');
        }

        if (!ensureConversationCanControl('edit this prompt')) {
          return;
        }

        setPendingAssistantStatusLabel('Rerunning from edited prompt…');
        const forked = await retryLiveSessionActionAfterTakeover({
          attemptAction: () =>
            api.forkSession(
              liveConversationId,
              entryId,
              {
                preserveSource: false,
                beforeEntry: true,
                branchKind: 'rewind',
              },
              currentSurfaceId,
            ),
          takeOverSessionControl: () => streamTakeover(),
        });
        const { newSessionId } = forked;
        primeForkedConversationOpenCaches(forked);
        window.dispatchEvent(
          new CustomEvent('pa:companion-chat-open', {
            detail: { conversationId: newSessionId },
          }),
        );
        await api.promptSession(newSessionId, editedText, undefined, undefined, undefined, currentSurfaceId);
        showNotice('accent', 'Conversation rerunning from edited prompt.');
      } catch (error) {
        showNotice('danger', formatConversationMessageActionFailure('Edit', error));
      } finally {
        setPendingAssistantStatusLabel(null);
      }
    },
    [
      currentSurfaceId,
      ensureConversationCanControl,
      ensureConversationIsLive,
      id,
      messageIndexOffset,
      primeForkedConversationOpenCaches,
      realMessages,
      showNotice,
      streamTakeover,
    ],
  );

  const forkConversationFromMessage = useCallback(
    async (messageIndex: number) => {
      const actionState = visibleTranscriptActionStateRef.current;
      const actionMessages = actionState?.conversationId === id && actionState.messages.length > 0 ? actionState.messages : realMessages;
      const actionMessageIndexOffset =
        actionState?.conversationId === id && actionState.messages.length > 0 ? actionState.historicalBlockOffset : messageIndexOffset;
      if (!id || !actionMessages) {
        return;
      }

      const localMessageIndex = messageIndex - actionMessageIndexOffset;
      if (localMessageIndex < 0 || localMessageIndex >= actionMessages.length) {
        showNotice('danger', 'Load the relevant part of the conversation before branching from it.');
        return;
      }

      const clickedBlock = actionMessages[localMessageIndex];
      if (clickedBlock?.type !== 'text' && clickedBlock?.type !== 'user') {
        await rewindConversationFromMessage(messageIndex);
        return;
      }

      try {
        const liveConversationId = await ensureConversationIsLive('be forked');
        let entryId = resolveSessionEntryIdFromBlockId(clickedBlock.id);
        if (!entryId) {
          const detail = await api.sessionDetail(liveConversationId, {
            tailBlocks: Math.max(realMessages.length, 1),
          });
          entryId = resolveBranchEntryIdFromSessionDetailResult(clickedBlock, messageIndex, detail);
        }
        if (!entryId) {
          throw new Error('The selected message is not ready to branch yet. Try again in a moment.');
        }

        if (!ensureConversationCanControl('branch from this message')) {
          return;
        }

        let newSessionId: string;
        if (clickedBlock.type === 'user') {
          const forked = await retryLiveSessionActionAfterTakeover({
            attemptAction: () =>
              api.forkSession(
                liveConversationId,
                entryId,
                {
                  preserveSource: true,
                  beforeEntry: true,
                  branchKind: 'fork',
                },
                currentSurfaceId,
              ),
            takeOverSessionControl: () => streamTakeover(),
          });
          primeForkedConversationOpenCaches(forked);
          newSessionId = forked.newSessionId;
        } else {
          const branched = await retryLiveSessionActionAfterTakeover({
            attemptAction: () => api.branchSession(liveConversationId, entryId, currentSurfaceId),
            takeOverSessionControl: () => streamTakeover(),
          });
          primeForkedConversationOpenCaches(branched);
          newSessionId = branched.newSessionId;
        }
        if (clickedBlock.type === 'user') {
          persistForkPromptDraft(newSessionId, clickedBlock.text);
        }
        window.dispatchEvent(
          new CustomEvent('pa:companion-chat-open', {
            detail: {
              conversationId: newSessionId,
              title: clickedBlock.type === 'user' ? `Fork: ${clickedBlock.text.slice(0, 40)}` : undefined,
            },
          }),
        );
      } catch (error) {
        showNotice('danger', formatConversationMessageActionFailure('Fork', error));
      }
    },
    [
      currentSurfaceId,
      ensureConversationCanControl,
      ensureConversationIsLive,
      id,
      messageIndexOffset,
      primeForkedConversationOpenCaches,
      realMessages,
      rewindConversationFromMessage,
      showNotice,
      streamTakeover,
    ],
  );

  async function saveModelPreference(modelId: string) {
    if (shouldSkipModelPreferenceSave({ modelId, currentModel, savingPreference, models })) {
      return;
    }

    setSavingPreference('model');
    try {
      if (draft) {
        const update = resolveDraftModelPreferenceUpdate({ modelId, defaultModel });
        if (update.storage.kind === 'clear') {
          clearDraftConversationModel();
        } else {
          persistDraftConversationModel(update.storage.value);
        }
        setCurrentModel(update.currentModel);
      } else if (id) {
        if (
          shouldEnsureControlForPreferenceSave({ isLiveSession, conversationId: id }) &&
          !ensureConversationCanControl('change the model')
        ) {
          return;
        }

        const next = await api.updateConversationModelPreferences(id, { model: modelId }, currentSurfaceId);
        setCurrentModel(next.currentModel);
        setCurrentThinkingLevel(next.currentThinkingLevel);
        setCurrentServiceTier(next.currentServiceTier);
        setHasExplicitServiceTier(next.hasExplicitServiceTier);
      }

      const selectedModelNotice = resolveSelectedModelNotice(models, modelId);
      if (selectedModelNotice) {
        showNotice('accent', selectedModelNotice);
      }
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    } finally {
      setSavingPreference(null);
    }
  }

  async function saveThinkingLevelPreference(thinkingLevel: string) {
    if (shouldSkipThinkingPreferenceSave({ thinkingLevel, currentThinkingLevel, savingPreference })) {
      return;
    }

    setSavingPreference('thinking');
    try {
      let savedThinkingLevel = thinkingLevel || defaultThinkingLevel;

      if (draft) {
        const update = resolveDraftThinkingPreferenceUpdate({ thinkingLevel, defaultThinkingLevel });
        if (update.storage.kind === 'clear') {
          clearDraftConversationThinkingLevel();
        } else {
          persistDraftConversationThinkingLevel(update.storage.value);
        }
        setCurrentThinkingLevel(update.currentThinkingLevel);
        savedThinkingLevel = update.currentThinkingLevel;
      } else if (id) {
        if (
          shouldEnsureControlForPreferenceSave({ isLiveSession, conversationId: id }) &&
          !ensureConversationCanControl('change the thinking level')
        ) {
          return;
        }

        const next = await api.updateConversationModelPreferences(id, { thinkingLevel }, currentSurfaceId);
        setCurrentModel(next.currentModel);
        setCurrentThinkingLevel(next.currentThinkingLevel);
        setCurrentServiceTier(next.currentServiceTier);
        setHasExplicitServiceTier(next.hasExplicitServiceTier);
        savedThinkingLevel = next.currentThinkingLevel;
      }

      showNotice('accent', `Thinking level set to ${formatThinkingLevelLabel(savedThinkingLevel)}.`);
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    } finally {
      setSavingPreference(null);
    }
  }

  async function saveServiceTierPreference(serviceTier: string) {
    if (serviceTier === currentServiceTier || savingPreference !== null) {
      return;
    }

    setSavingPreference('serviceTier');
    try {
      if (draft) {
        setCurrentServiceTier(serviceTier || defaultServiceTier);
        setHasExplicitServiceTier(Boolean(serviceTier));
      } else if (id) {
        if (
          shouldEnsureControlForPreferenceSave({ isLiveSession, conversationId: id }) &&
          !ensureConversationCanControl('change the service tier')
        ) {
          return;
        }

        const next = await api.updateConversationModelPreferences(id, { serviceTier: serviceTier || null }, currentSurfaceId);
        setCurrentModel(next.currentModel);
        setCurrentThinkingLevel(next.currentThinkingLevel);
        setCurrentServiceTier(next.currentServiceTier);
        setHasExplicitServiceTier(next.hasExplicitServiceTier);
      }
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    } finally {
      setSavingPreference(null);
    }
  }

  function selectModel(modelId: string) {
    if (shouldClearComposerForModelSelection(showModelPicker)) {
      composerController.clear();
    }
    setModelIdx(0);
    moveComposerCaretToEnd();
    void saveModelPreference(modelId);
  }

  function addImageAttachments(imageAttachments: ComposerImageAttachment[]) {
    setAttachments((prev) => appendIfPresent(prev, imageAttachments));
  }

  async function addComposerFiles(files: File[]) {
    const {
      imageAttachments: nextImageAttachments,
      drawingAttachments: nextDrawingAttachments,
      rejectedFileNames,
      drawingParseFailures,
      imageReadFailures,
    } = await prepareComposerFiles(files);

    if (nextImageAttachments.length > 0) {
      addImageAttachments(nextImageAttachments);
    }

    if (nextDrawingAttachments.length > 0) {
      setDrawingAttachments((current) => appendIfPresent(current, nextDrawingAttachments));
    }

    for (const notice of buildComposerFilePreparationNotices({
      drawingAttachments: nextDrawingAttachments,
      drawingParseFailures,
      imageReadFailures,
      rejectedFileNames,
    })) {
      showNotice(notice.tone, notice.text, notice.durationMs);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function removeDrawingAttachment(localId: string) {
    setDrawingAttachments((current) => removeComposerDrawingAttachmentByLocalId(current, localId));
  }

  function upsertDrawingAttachment(payload: ExcalidrawEditorSavePayload, localId?: string) {
    setDrawingAttachments((current) => {
      const targetLocalId = localId ?? payload.localId;
      const dirty = payload.dirty ?? true;
      const nextAttachment = (existingLocalId: string): ComposerDrawingAttachment =>
        ({
          localId: existingLocalId,
          attachmentId: payload.attachmentId,
          revision: payload.revision,
          title: payload.title,
          sourceData: payload.sourceData,
          sourceMimeType: payload.sourceMimeType,
          sourceName: payload.sourceName,
          previewData: payload.previewData,
          previewMimeType: payload.previewMimeType,
          previewName: payload.previewName,
          previewUrl: payload.previewUrl,
          scene: payload.scene,
          dirty,
        }) satisfies ComposerDrawingAttachment;

      if (targetLocalId && current.some((attachment) => attachment.localId === targetLocalId)) {
        return current.map((attachment) => (attachment.localId === targetLocalId ? nextAttachment(attachment.localId) : attachment));
      }

      if (payload.attachmentId && current.some((attachment) => attachment.attachmentId === payload.attachmentId)) {
        return current.map((attachment) =>
          attachment.attachmentId === payload.attachmentId ? nextAttachment(attachment.localId) : attachment,
        );
      }

      return [...current, nextAttachment(targetLocalId ?? createComposerDrawingLocalId())];
    });
  }

  async function editDrawing(localId: string) {
    const drawing = drawingAttachments.find((attachment) => attachment.localId === localId);
    if (!drawing) return;

    const excalidrawTool = extensionRegistry.composerInputTools.find((tool) => tool.id === 'excalidraw');
    if (!excalidrawTool) {
      showNotice('danger', 'Drawing editor is unavailable.', 4000);
      return;
    }

    const excalidrawInputClient = createNativeExtensionClient(excalidrawTool.extensionId);
    const result = await excalidrawInputClient.ui.openModal({
      component: 'ExcalidrawEditorModal',
      props: {
        conversationId: id,
        initialTitle: drawing.title,
        initialScene: drawing.scene,
        initialAttachmentId: drawing.attachmentId,
        initialRevision: drawing.revision,
        localId,
        saveLabel: 'Update attachment',
      },
      size: 'fullscreen',
    });

    if (result && typeof result === 'object') {
      upsertDrawingAttachment(result as ExcalidrawEditorSavePayload, localId);
      showNotice('accent', 'Drawing attached to composer.');
    }
  }

  async function attachSavedDrawing(selection: { attachment: ConversationAttachmentSummary; revision: number }) {
    if (!id) {
      showNotice('danger', 'Saved drawing picker requires an existing conversation.', 4000);
      return;
    }

    setDrawingsBusy(true);
    setDrawingsError(null);
    try {
      const detail = await api.conversationAttachment(id, selection.attachment.id);
      const record = detail.attachment;
      const revision = record.revisions.find((entry) => entry.revision === selection.revision) ?? record.latestRevision;

      const sourceDataUrl = (await api.conversationAttachmentAsset(id, record.id, 'source', revision.revision)).dataUrl;
      const sourceCommaIndex = sourceDataUrl.indexOf(',');
      const sourceData = sourceCommaIndex >= 0 ? sourceDataUrl.slice(sourceCommaIndex + 1) : sourceDataUrl;
      const previewDataUrl = (await api.conversationAttachmentAsset(id, record.id, 'preview', revision.revision)).dataUrl;
      const previewCommaIndex = previewDataUrl.indexOf(',');
      const previewData = previewCommaIndex >= 0 ? previewDataUrl.slice(previewCommaIndex + 1) : previewDataUrl;
      const scene = parseExcalidrawSceneFromSourceData(sourceData);

      const nextAttachment: ComposerDrawingAttachment = {
        localId: createComposerDrawingLocalId(),
        attachmentId: record.id,
        revision: revision.revision,
        title: record.title,
        sourceData,
        sourceMimeType: revision.sourceMimeType,
        sourceName: revision.sourceName,
        previewData,
        previewMimeType: revision.previewMimeType,
        previewName: revision.previewName,
        previewUrl: previewDataUrl,
        scene,
        dirty: false,
      };

      setDrawingAttachments((current) => {
        const alreadyAttached = current.some(
          (attachment) =>
            attachment.attachmentId === nextAttachment.attachmentId && attachment.revision === nextAttachment.revision && !attachment.dirty,
        );

        if (alreadyAttached) {
          return current;
        }

        return [...current, nextAttachment];
      });

      setDrawingsPickerOpen(false);
      showNotice('accent', `Attached drawing ${record.title} (rev ${revision.revision}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDrawingsError(message);
      showNotice('danger', message, 4000);
    } finally {
      setDrawingsBusy(false);
    }
  }

  async function persistDrawingsForConversation(
    conversationId: string,
    currentDrawings: ComposerDrawingAttachment[],
  ): Promise<ComposerDrawingAttachment[]> {
    const persisted: ComposerDrawingAttachment[] = [];

    for (const drawing of currentDrawings) {
      if (drawing.attachmentId && !drawing.dirty) {
        persisted.push(drawing);
        continue;
      }

      if (drawing.attachmentId) {
        const result = await api.updateConversationAttachment(conversationId, drawing.attachmentId, {
          title: drawing.title,
          sourceData: drawing.sourceData,
          sourceName: drawing.sourceName,
          sourceMimeType: drawing.sourceMimeType,
          previewData: drawing.previewData,
          previewName: drawing.previewName,
          previewMimeType: drawing.previewMimeType,
        });

        persisted.push({
          ...drawing,
          attachmentId: result.attachment.id,
          revision: result.attachment.currentRevision,
          title: result.attachment.title,
          sourceName: result.attachment.latestRevision.sourceName,
          sourceMimeType: result.attachment.latestRevision.sourceMimeType,
          previewName: result.attachment.latestRevision.previewName,
          previewMimeType: result.attachment.latestRevision.previewMimeType,
          dirty: false,
        });
        continue;
      }

      const result = await api.createConversationAttachment(conversationId, {
        kind: 'excalidraw',
        title: drawing.title,
        sourceData: drawing.sourceData,
        sourceName: drawing.sourceName,
        sourceMimeType: drawing.sourceMimeType,
        previewData: drawing.previewData,
        previewName: drawing.previewName,
        previewMimeType: drawing.previewMimeType,
      });

      persisted.push({
        ...drawing,
        attachmentId: result.attachment.id,
        revision: result.attachment.currentRevision,
        title: result.attachment.title,
        sourceName: result.attachment.latestRevision.sourceName,
        sourceMimeType: result.attachment.latestRevision.sourceMimeType,
        previewName: result.attachment.latestRevision.previewName,
        previewMimeType: result.attachment.latestRevision.previewMimeType,
        dirty: false,
      });
    }

    return persisted;
  }

  async function scheduleDeferredResume(delay: string, prompt?: string, behavior?: 'steer' | 'followUp') {
    if (!id || draft) {
      showNotice('danger', 'Wakeup requires an existing conversation.', 4000);
      return;
    }

    setDeferredResumesBusy(true);
    try {
      const result = await api.scheduleDeferredResume(id, { delay, prompt, behavior });
      setDeferredResumes(result.resumes);
      await desktopConversationRefresh().catch(() => {});
      composerController.clear();
      showNotice(
        'accent',
        `Wakeup scheduled${behavior === 'followUp' ? ' as follow-up' : ''} for ${describeDeferredResumeStatus(result.resume)}.`,
      );
    } catch (error) {
      showNotice('danger', formatDeferredResumeOperationFailure('schedule', error), 4000);
    } finally {
      setDeferredResumesBusy(false);
    }
  }

  async function fireDeferredResumeNow(resumeId: string) {
    if (!id) {
      return;
    }

    setDeferredResumesBusy(true);
    try {
      const result = await api.fireDeferredResumeNow(id, resumeId);
      setDeferredResumes(result.resumes);
      await desktopConversationRefresh().catch(() => {});
      showNotice('accent', 'Wakeup firing…');
    } catch (error) {
      showNotice('danger', formatDeferredResumeOperationFailure('fire', error), 4000);
    } finally {
      setDeferredResumesBusy(false);
    }
  }

  async function cancelDeferredResume(resumeId: string) {
    if (!id) {
      return;
    }

    setDeferredResumesBusy(true);
    try {
      const result = await api.cancelDeferredResume(id, resumeId);
      setDeferredResumes(result.resumes);
      await desktopConversationRefresh().catch(() => {});
      showNotice('accent', 'Wakeup cancelled.');
    } catch (error) {
      showNotice('danger', formatDeferredResumeOperationFailure('cancel', error), 4000);
    } finally {
      setDeferredResumesBusy(false);
    }
  }

  async function continueDeferredResumesNow() {
    if (!id) {
      return;
    }

    try {
      await resumeDeferredConversation('resume deferred work', { forceResume: true });
      showNotice('accent', 'Resuming deferred work…');
    } catch (error) {
      showNotice('danger', formatDeferredResumeOperationFailure('continue', error), 4000);
    }
  }

  const resumeConversation = useCallback(async () => {
    if (!id || draft || resumeConversationBusy) {
      return;
    }

    setResumeConversationBusy(true);
    try {
      const result = await api.resumeConversation(id);
      if (result.conversationId && result.conversationId !== id) {
        ensureConversationTabOpen(result.conversationId);
        navigate(`/conversations/${result.conversationId}`);
        return;
      }

      setConfirmedLive(true);
      stream.reconnect();
      showNotice(
        'accent',
        result.replayedPendingOperation
          ? 'Continuing interrupted turn…'
          : result.usedFallbackPrompt
            ? 'Continuing with a follow-up prompt…'
            : 'Conversation ready to continue.',
      );
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    } finally {
      setResumeConversationBusy(false);
    }
  }, [draft, id, navigate, resumeConversationBusy, showNotice, stream.reconnect]);

  async function renameConversationTo(nextTitle: string) {
    if (draft || !id) {
      showNotice('danger', 'Renaming requires an existing conversation.', 4000);
      return;
    }

    setTitleSaving(true);
    try {
      if (!ensureConversationCanControl('rename it')) {
        return;
      }

      const result = await api.renameConversation(id, nextTitle, currentSurfaceId);
      setTitleOverride(result.title);
      pushTitle(id, result.title);
      titleStore.set(id, result.title);
      sessionStore.patch(id, { title: result.title });
      setIsEditingTitle(false);
      showNotice('accent', 'Conversation renamed.');
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    } finally {
      setTitleSaving(false);
    }
  }

  const setDraftConversationCwd = useCallback((nextCwd: string) => {
    const normalizedCwd = nextCwd.trim();
    if (normalizedCwd) {
      persistDraftConversationCwd(normalizedCwd);
    } else {
      clearDraftConversationCwd();
    }

    setDraftCwdValue(normalizedCwd);
  }, []);

  const pickDraftConversationCwd = useCallback(async () => {
    if (!draft || draftCwdPickBusy) {
      return;
    }

    setDraftCwdPickBusy(true);
    setDraftCwdError(null);
    try {
      const result = await api.pickFolder({
        cwd: draftCwdValue || undefined,
        prompt: 'Choose a workspace folder',
      });
      if (result.cancelled || !result.path) {
        return;
      }

      const nextWorkspacePaths = syncLocalSavedWorkspacePaths([...savedWorkspacePaths, result.path]);
      void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
        // Ignore best-effort sync failures.
      });
      setDraftConversationCwd(result.path);
    } catch (error) {
      setDraftCwdError(error instanceof Error ? error.message : 'Could not choose a folder.');
    } finally {
      setDraftCwdPickBusy(false);
    }
  }, [draft, draftCwdPickBusy, draftCwdValue, savedWorkspacePaths, setDraftConversationCwd, syncLocalSavedWorkspacePaths]);

  const selectDraftConversationWorkspace = useCallback(
    (workspacePath: string) => {
      const normalizedWorkspacePath = workspacePath.trim();
      if (!normalizedWorkspacePath) {
        return;
      }

      setDraftConversationCwd(normalizedWorkspacePath);
      setDraftCwdError(null);
    },
    [setDraftConversationCwd],
  );

  const clearDraftConversationCwdSelection = useCallback(() => {
    clearDraftConversationCwd();
    setDraftCwdValue('');
    setDraftCwdError(null);
  }, []);

  useDesktopConversationShortcuts({
    draft,
    draftCwdPickBusy,
    textareaRef,
    beginTitleEdit,
    saveTitleEdit,
    cancelTitleEdit,
    beginConversationCwdEdit,
    saveConversationCwdEdit: submitConversationCwdChange,
    cancelConversationCwdEdit,
    pickDraftConversationCwd,
  });

  function findExtensionSlashCommand(text: string): { command: ExtensionSlashCommandRegistration; argument: string } | null {
    return findExtensionSlashCommandMatch(text, extensionSlashCommands);
  }

  function applyExtensionSlashCommandResult(
    result: ExtensionSlashCommandResult,
    inputSnapshot: string,
  ): { kind: 'handled' } | { kind: 'send'; text: string } {
    if (result.kind === 'notice') {
      showNotice(result.tone, result.text);
      return applyExtensionSlashCommandResult(result.next, inputSnapshot);
    }
    if (result.kind === 'send') {
      return { kind: 'send', text: result.text };
    }
    if (result.kind === 'replace') {
      composerController.setText(result.text);
      return { kind: 'handled' };
    }
    if (result.kind === 'append') {
      composerController.setText(`${inputSnapshot}${result.text}`);
      return { kind: 'handled' };
    }
    if (result.effect === 'clear') {
      composerController.clear();
    }
    return { kind: 'handled' };
  }

  async function executeExtensionSlashCommand(
    command: ExtensionSlashCommandRegistration,
    inputSnapshot: string,
    argument: string,
  ): Promise<{ kind: 'handled' } | { kind: 'send'; text: string }> {
    try {
      const response = await api.invokeExtensionAction(command.extensionId, command.action, {
        commandName: command.name,
        argument,
        text: inputSnapshot,
        conversationId: id ?? null,
        cwd: currentCwd,
        draft,
      });
      return applyExtensionSlashCommandResult(resolveExtensionSlashCommandResult(response.result), inputSnapshot);
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
      return { kind: 'handled' };
    }
  }

  async function buildDraftCreateLiveSessionOptions(): Promise<typeof createLiveSessionPreferenceInput> {
    return createLiveSessionPreferenceInput;
  }

  async function executeConversationSlashCommand(
    command: ConversationSlashCommand,
  ): Promise<{ kind: 'handled' } | { kind: 'send'; text: string }> {
    const execution = resolveConversationSlashCommandExecution(command);
    if (execution.kind === 'send') {
      return execution;
    }

    switch (command.action) {
      case 'compact': {
        if (draft) {
          showNotice('danger', 'Compaction requires an existing conversation.', 4000);
          return { kind: 'handled' };
        }

        composerController.clear();
        try {
          const liveConversationId = await ensureConversationIsLive('be compacted');
          await retryLiveSessionActionAfterTakeover({
            attemptAction: () => api.compactSession(liveConversationId, command.customInstructions, currentSurfaceId),
            takeOverSessionControl: () => streamTakeover(),
          });
          showNotice('accent', 'Manual compaction complete.');
        } catch (error) {
          showNotice('danger', formatConversationLocalActionFailure(error, 'Could not compact this conversation.'), 4000);
        }
        return { kind: 'handled' };
      }
      case 'export': {
        if (draft) {
          showNotice('danger', 'Export requires an existing conversation.', 4000);
          return { kind: 'handled' };
        }

        composerController.clear();
        try {
          let liveConversationId = await ensureConversationIsLive('be exported');
          const exported = await retryConversationActionAfterNotLive({
            attemptAction: () => api.exportSession(liveConversationId, command.outputPath),
            recoverLiveSession: async () => {
              setConfirmedLive(false);
              liveConversationId = await ensureConversationIsLive('be exported', { forceResume: true });
            },
          });
          showNotice('accent', exported.path ? `Conversation exported to ${exported.path}.` : 'Conversation exported.');
        } catch (error) {
          showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
        }
        return { kind: 'handled' };
      }
      case 'name': {
        const nextTitle = command.name?.trim();
        if (!nextTitle) {
          showNotice('danger', 'Usage: /name <title>', 4000);
          return { kind: 'handled' };
        }

        composerController.clear();
        await renameConversationTo(nextTitle);
        return { kind: 'handled' };
      }
      case 'copy': {
        const actionState = visibleTranscriptActionStateRef.current;
        const messages = actionState?.conversationId === id && actionState.messages.length > 0 ? actionState.messages : realMessages;
        const text = findLastAssistantMessageText(messages);
        if (!text) {
          showNotice('danger', 'No assistant message is available to copy.', 4000);
          return { kind: 'handled' };
        }

        composerController.clear();
        try {
          await writeClipboardText(text);
          showNotice('accent', 'Copied last assistant message.');
        } catch (error) {
          showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
        }
        return { kind: 'handled' };
      }
    }

    return { kind: 'handled' };
  }

  const handleReplyToSelection = useCallback(
    (selection: { text: string; action?: { args?: unknown } }) => {
      if (!selection.text) {
        return;
      }

      const currentInput = textareaRef.current?.value ?? input;
      const quoted = insertReplyQuoteIntoComposer(currentInput, selection.text);
      const args =
        selection.action?.args && typeof selection.action.args === 'object' ? (selection.action.args as Record<string, unknown>) : null;
      const starter = typeof args?.draftText === 'string' ? args.draftText.trim() : '';
      const nextText = starter
        ? `${quoted.text.slice(0, quoted.selectionStart)}${starter}${quoted.text.slice(quoted.selectionEnd)}`
        : quoted.text;
      const nextSelectionStart = starter ? quoted.selectionStart + starter.length : quoted.selectionStart;
      const nextSelectionEnd = starter ? nextSelectionStart : quoted.selectionEnd;

      composerController.setText(nextText, { selection: { start: nextSelectionStart, end: nextSelectionEnd } });
    },
    [composerController, input],
  );

  async function runWholeLineBashCommand(inputSnapshot: string, command: { command: string; excludeFromContext: boolean }) {
    if (wholeLineBashRunningRef.current) {
      return;
    }

    const normalizedCommand = command.command.trim();
    if (!normalizedCommand) {
      showNotice('danger', 'Usage: !<command>', 4000);
      return;
    }

    wholeLineBashRunningRef.current = true;
    setWholeLineBashRunning(true);
    setPendingAssistantStatusLabel('Running bash…');
    composerController.clear();
    rememberComposerInput(inputSnapshot);

    try {
      let conversationId = id ?? null;
      let navigatedDraftConversation = false;

      if (!conversationId) {
        const draftOptions = await buildDraftCreateLiveSessionOptions();
        const created = await api.createLiveSession(draftCwdValue || undefined, undefined, draftOptions);
        conversationId = created.id;

        if (draft) {
          clearDraftConversationComposer();
          clearDraftConversationAttachments();
          clearDraftConversationCwd();
          clearDraftConversationModelPreferences();
          ensureConversationTabOpen(conversationId);
          navigate(`/conversations/${conversationId}`, {
            replace: true,
            state: {
              initialModelPreferenceState: buildConversationInitialModelPreferenceState({
                conversationId,
                currentModel,
                currentThinkingLevel,
                currentServiceTier,
                hasExplicitServiceTier,
                defaultModel,
                defaultThinkingLevel,
                defaultServiceTier,
              }),
              initialDeferredResumeState: {
                conversationId,
                resumes: [],
              },
            },
          });
          navigatedDraftConversation = true;
        }
      } else {
        conversationId = await ensureConversationIsLive('run bash commands');
      }

      pendingWholeLineBashRef.current = { conversationId, command: normalizedCommand };
      await retryConversationActionAfterNotLive({
        attemptAction: () =>
          api.executeLiveSessionBash(conversationId, normalizedCommand, {
            excludeFromContext: command.excludeFromContext,
          }),
        recoverLiveSession: async () => {
          setConfirmedLive(false);
          conversationId = await ensureConversationIsLive('run bash commands', { forceResume: true });
          pendingWholeLineBashRef.current = { conversationId, command: normalizedCommand };
        },
      });

      pendingWholeLineBashRef.current = null;
      wholeLineBashRunningRef.current = false;
      setWholeLineBashRunning(false);
      setPendingAssistantStatusLabel(null);
      const currentRuntime = conversationRuntimeStore.get(conversationId);
      conversationRuntimeStore.apply({
        id: conversationId,
        running: false,
        revision: (currentRuntime?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      });

      if (conversationId === id || navigatedDraftConversation) {
        notifyDesktopConversationStateRefresh(conversationId);
        const refreshAfterBash = () => {
          void desktopConversationRefresh().catch(() => undefined);
        };
        if (navigatedDraftConversation) {
          window.requestAnimationFrame(() => notifyDesktopConversationStateRefresh(conversationId));
          window.setTimeout(() => notifyDesktopConversationStateRefresh(conversationId), 250);
          window.setTimeout(() => notifyDesktopConversationStateRefresh(conversationId), 1_000);
        }
        await desktopConversationRefresh().catch(() => null);
        window.setTimeout(refreshAfterBash, 250);
        window.setTimeout(refreshAfterBash, 1_000);
      }

      if (draft && !navigatedDraftConversation) {
        clearDraftConversationComposer();
        clearDraftConversationAttachments();
        clearDraftConversationCwd();
        clearDraftConversationModelPreferences();
      }

      if (conversationId !== id && !navigatedDraftConversation) {
        ensureConversationTabOpen(conversationId);
        navigate(`/conversations/${conversationId}`, {
          replace: draft,
          state: {
            initialModelPreferenceState: buildConversationInitialModelPreferenceState({
              conversationId,
              currentModel,
              currentThinkingLevel,
              currentServiceTier,
              hasExplicitServiceTier,
              defaultModel,
              defaultThinkingLevel,
              defaultServiceTier,
            }),
            initialDeferredResumeState: {
              conversationId,
              resumes: [],
            },
          },
        });
        return;
      }

      window.setTimeout(() => {
        scrollToBottom();
      }, 50);
    } catch (error) {
      pendingWholeLineBashRef.current = null;
      composerController.setText(inputSnapshot);
      showNotice('danger', formatConversationMessageActionFailure('Bash command', error), 4000);
    } finally {
      if (!pendingWholeLineBashRef.current) {
        wholeLineBashRunningRef.current = false;
        setWholeLineBashRunning(false);
        setPendingAssistantStatusLabel(null);
      }
    }
  }

  async function submitComposer(behavior?: 'steer' | 'followUp') {
    if (preparingRelatedThreadContext) {
      return;
    }
    if (composerSubmitRunningRef.current) {
      return;
    }
    composerSubmitRunningRef.current = true;

    const submitStartedAtMs = performance.now();
    const recordSubmitPhase = (phase: string, startedAtMs: number, meta?: Record<string, unknown>) => {
      recordClientPerfTiming({
        name: 'conversation.submitComposer.phase',
        startedAtMs,
        meta: { phase, draft, hasConversationId: Boolean(id), ...(meta ?? {}) },
      });
    };

    try {
      const inputSnapshot = textareaRef.current?.value ?? input;
      const text = inputSnapshot.trim();
      const pendingImageAttachments = attachments;
      const pendingDrawingAttachments = drawingAttachments;
      const pendingAttachedContextDocs = attachedContextDocs;
      const pendingBrowserCommentsSnapshot = pendingBrowserComments;
      const browserCommentContextMessages = buildBrowserCommentContextMessages(pendingBrowserCommentsSnapshot);
      if (
        !text &&
        pendingImageAttachments.length === 0 &&
        pendingDrawingAttachments.length === 0 &&
        pendingBrowserCommentsSnapshot.length === 0
      ) {
        return;
      }

      let slashTextToSend: string | null = null;
      if (pendingImageAttachments.length === 0 && pendingDrawingAttachments.length === 0 && pendingBrowserCommentsSnapshot.length === 0) {
        const wholeLineBash = parseWholeLineBashCommand(text);
        if (wholeLineBash) {
          await runWholeLineBashCommand(inputSnapshot, wholeLineBash);
          return;
        }

        const deferredResumeSlash = parseDeferredResumeSlashCommand(text);
        if (deferredResumeSlash) {
          if (deferredResumeSlash.kind === 'invalid') {
            showNotice('danger', deferredResumeSlash.message, 4000);
          } else {
            rememberComposerInput(inputSnapshot);
            await scheduleDeferredResume(
              deferredResumeSlash.command.delay,
              deferredResumeSlash.command.prompt,
              deferredResumeSlash.command.behavior,
            );
          }
          return;
        }

        const conversationSlash = parseConversationSlashCommand(text);
        if (conversationSlash) {
          if (conversationSlash.kind === 'invalid') {
            showNotice('danger', conversationSlash.message, 4000);
            return;
          }

          if (!['run', 'search', 'summarize', 'think'].includes(conversationSlash.command.action)) {
            rememberComposerInput(inputSnapshot);
          }

          const slashResult = await executeConversationSlashCommand(conversationSlash.command);
          if (slashResult.kind === 'handled') {
            return;
          }

          slashTextToSend = slashResult.text;
        } else {
          const extensionSlash = findExtensionSlashCommand(text);
          if (extensionSlash) {
            rememberComposerInput(inputSnapshot);
            const slashResult = await executeExtensionSlashCommand(extensionSlash.command, inputSnapshot, extensionSlash.argument);
            if (slashResult.kind === 'handled') {
              return;
            }

            slashTextToSend = slashResult.text;
          }
        }
      }

      const filePromptImages = buildPromptImages(pendingImageAttachments);
      const drawingPromptImages = pendingDrawingAttachments.map((drawing) => drawingAttachmentToPromptImage(drawing));
      const promptImages = [...filePromptImages, ...drawingPromptImages];
      const textToSend = slashTextToSend ?? text;
      const browserContextStartedAtMs = performance.now();
      const browserChangedContextMessage = await readBrowserChangedContextMessage(id ?? 'draft');
      recordSubmitPhase('browserContext', browserContextStartedAtMs, { hasMessage: Boolean(browserChangedContextMessage) });
      const browserContextMessages = mergeContextMessages(
        browserCommentContextMessages,
        browserChangedContextMessage ? [browserChangedContextMessage] : undefined,
      );

      composerController.clear();
      setAttachments([]);
      setDrawingAttachments([]);
      setPendingBrowserComments([]);
      setDrawingsError(null);

      const requestedBehavior = behavior ?? (isLiveSession ? defaultComposerBehavior : undefined);
      const queuedBehavior = normalizeConversationComposerBehavior(requestedBehavior, allowQueuedPrompts);

      const persistPromptDrawings = async (conversationId: string): Promise<PromptAttachmentRefInput[]> => {
        if (pendingDrawingAttachments.length === 0) {
          return [];
        }

        setDrawingsBusy(true);
        try {
          const persistedDrawings = await persistDrawingsForConversation(conversationId, pendingDrawingAttachments);
          return persistedDrawings
            .map((drawing) => drawingAttachmentToPromptRef(drawing))
            .filter((attachmentRef): attachmentRef is PromptAttachmentRefInput => attachmentRef !== null);
        } finally {
          setDrawingsBusy(false);
        }
      };

      const persistPromptContextDocs = async (conversationId: string): Promise<ConversationContextDocRef[]> => {
        if (pendingAttachedContextDocs.length === 0) {
          return [];
        }

        const result = await api.updateConversationContextDocs(conversationId, pendingAttachedContextDocs);
        return result.attachedContextDocs;
      };

      const waitForDraftPendingPromptPaint = () =>
        new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
          });
        });

      if (!id && !visibleSessionDetail) {
        const selectedRelatedThreadIdsSnapshot = [...selectedRelatedThreadIds];

        if (selectedRelatedThreadIdsSnapshot.length > 0) {
          let createdSessionId: string | null = null;
          let navigatedToCreatedConversation = false;
          setPreparingRelatedThreadContext(true);
          setPendingAssistantStatusLabel('Creating conversation…');

          try {
            const draftOptions = await buildDraftCreateLiveSessionOptions();
            const created = await api.createLiveSession(draftCwdValue || undefined, undefined, draftOptions);
            createdSessionId = created.id;
            primeCreatedConversationOpenCaches(created, {
              tailBlocks: INITIAL_HISTORICAL_TAIL_BLOCKS,
              bootstrapVersionKey: conversationVersionKey,
              sessionDetailVersion: conversationEventVersion,
            });

            const attachmentRefs = await persistPromptDrawings(created.id);
            await persistPromptContextDocs(created.id);

            const initialPrompt: PendingConversationPrompt = {
              text: textToSend,
              behavior: queuedBehavior,
              images: promptImages,
              attachmentRefs,
              contextMessages: browserContextMessages,
              relatedConversationIds: selectedRelatedThreadIdsSnapshot,
            };

            rememberComposerInput(inputSnapshot, created.id);
            persistPendingConversationPrompt(created.id, initialPrompt);
            setPendingConversationPromptDispatching(created.id, true);
            const sendResult = await api.promptSession(
              created.id,
              initialPrompt.text,
              initialPrompt.behavior,
              initialPrompt.images,
              initialPrompt.attachmentRefs,
              undefined,
              initialPrompt.contextMessages,
              normalizePendingRelatedConversationIds(initialPrompt),
            );
            for (const warning of sendResult.relatedConversationPointerWarnings ?? []) {
              showNotice('danger', warning, 5000);
            }
            if (sendResult.accepted) {
              clearPendingConversationPrompt(created.id);
            }
            setPendingConversationPromptDispatching(created.id, false);

            clearDraftConversationAttachments();
            clearDraftConversationContextDocs();
            clearDraftConversationCwd();
            clearDraftConversationModelPreferences();
            setSelectedRelatedThreadIds([]);

            ensureConversationTabOpen(created.id);
            navigate(`/conversations/${created.id}`, {
              replace: true,
              state: {
                initialModelPreferenceState: buildConversationInitialModelPreferenceState({
                  conversationId: created.id,
                  currentModel,
                  currentThinkingLevel,
                  currentServiceTier,
                  hasExplicitServiceTier,
                  defaultModel,
                  defaultThinkingLevel,
                  defaultServiceTier,
                }),
                initialDeferredResumeState: {
                  conversationId: created.id,
                  resumes: [],
                },
                preserveConversationSurfaceKey: 'draft',
              },
            });
            navigatedToCreatedConversation = true;
          } catch (error) {
            if (createdSessionId) {
              setPendingConversationPromptDispatching(createdSessionId, false);
            }
            if (createdSessionId && !navigatedToCreatedConversation) {
              await api.destroySession(createdSessionId).catch(() => {});
            }
            showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
            await restoreComposerDraft(inputSnapshot, pendingImageAttachments, pendingDrawingAttachments);
            setPendingBrowserComments(pendingBrowserCommentsSnapshot);
          } finally {
            setPreparingRelatedThreadContext(false);
            setPendingAssistantStatusLabel(null);
          }
          return;
        }

        rememberComposerInput(inputSnapshot);
        flushSync(() => {
          setDraftPendingPrompt({
            text: textToSend,
            behavior: queuedBehavior,
            images: promptImages,
            attachmentRefs: [],
            contextMessages: browserContextMessages,
          });
          setPendingAssistantStatusLabel(
            resolveConversationPendingStatusLabel({
              isLiveSession: false,
              hasVisibleSessionDetail: false,
            }),
          );
        });
        let createdSessionId: string | null = null;
        let navigatedToCreatedConversation = false;
        try {
          const draftPendingPromptPaintStartedAtMs = performance.now();
          await waitForDraftPendingPromptPaint();
          recordSubmitPhase('draftPendingPromptPaintYield', draftPendingPromptPaintStartedAtMs);
          const reserveStartedAtMs = performance.now();
          const draftOptionsPromise = buildDraftCreateLiveSessionOptions();
          const reserved = await api.reserveConversation(draftCwdValue || undefined);
          recordSubmitPhase('reserveConversation', reserveStartedAtMs, { conversationId: reserved.id, serverPerf: reserved.perf ?? null });
          createdSessionId = reserved.id;
          const primeCachesStartedAtMs = performance.now();
          primeReservedDesktopConversationStateCache(
            {
              conversationId: reserved.id,
              sessionFile: reserved.sessionFile,
              cwd: reserved.cwd,
            },
            { tailBlocks: INITIAL_HISTORICAL_TAIL_BLOCKS, includeToolBlocks: false },
          );
          recordSubmitPhase('primeReservedConversationCaches', primeCachesStartedAtMs, { conversationId: reserved.id });
          const createStartedAtMs = performance.now();
          primeCreatedConversationOpenCaches(
            {
              id: reserved.id,
              sessionFile: reserved.sessionFile,
            },
            {
              tailBlocks: INITIAL_HISTORICAL_TAIL_BLOCKS,
              bootstrapVersionKey: conversationVersionKey,
              sessionDetailVersion: conversationEventVersion,
            },
          );
          const newId = reserved.id;
          const persistDrawingsStartedAtMs = performance.now();
          const attachmentRefs = await persistPromptDrawings(newId);
          recordSubmitPhase('persistPromptDrawings', persistDrawingsStartedAtMs, { conversationId: newId, count: attachmentRefs.length });
          const persistContextDocsStartedAtMs = performance.now();
          await persistPromptContextDocs(newId);
          recordSubmitPhase('persistPromptContextDocs', persistContextDocsStartedAtMs, {
            conversationId: newId,
            count: pendingAttachedContextDocs.length,
          });
          const initialPrompt = {
            text: textToSend,
            behavior: queuedBehavior,
            images: promptImages,
            attachmentRefs,
            contextMessages: browserContextMessages,
          };

          rememberComposerInput(inputSnapshot, newId);
          persistPendingConversationPrompt(newId, initialPrompt);
          setPendingConversationPromptDispatching(newId, true);
          setPendingInitialPrompt(initialPrompt);
          setPendingInitialPromptDispatchingState(true);
          recordSubmitPhase('persistPendingPrompt', submitStartedAtMs, {
            conversationId: newId,
            inMemoryPromptText: readPendingConversationPrompt(newId)?.text ?? null,
            storageHasPendingPrompt:
              typeof window === 'undefined'
                ? null
                : window.sessionStorage.getItem(`pa:reload:conversation:${newId}:pending-prompt`) !== null,
          });
          const reservedCreateCwd = resolveReservedDraftConversationCreateCwd({
            reserved,
            draftCwdValue,
            isNeutralChatCwdPath,
          });
          const { createdPromise } = await startReservedDraftConversationLiveSessionCreate({
            reserved,
            initialPrompt,
            createLiveSession: async (reservedSessionFile, prompt) => {
              const draftOptions = await draftOptionsPromise;
              recordSubmitPhase('beforeDispatchInitialPrompt', createStartedAtMs, {
                conversationId: newId,
                delivery: 'createLiveSession',
              });
              return api.createLiveSession(reservedCreateCwd, prompt?.text, {
                ...draftOptions,
                workspaceCwd: reservedCreateCwd ?? null,
                ...(prompt?.behavior !== undefined ? { behavior: prompt.behavior } : {}),
                ...(prompt?.images !== undefined ? { images: prompt.images } : {}),
                ...(prompt?.attachmentRefs !== undefined ? { attachmentRefs: prompt.attachmentRefs } : {}),
                ...(prompt?.contextMessages !== undefined ? { contextMessages: prompt.contextMessages } : {}),
                ...(() => {
                  const relatedConversationIds = prompt ? normalizePendingRelatedConversationIds(prompt) : undefined;
                  return relatedConversationIds !== undefined ? { relatedConversationIds } : {};
                })(),
                reservedSessionFile,
              });
            },
            applyReservedConversation: async (conversationId) => {
              recordSubmitPhase('beforeNavigateReservedConversation', submitStartedAtMs, { conversationId });
              navigate(`/conversations/${conversationId}`, {
                replace: true,
                state: {
                  initialModelPreferenceState: buildConversationInitialModelPreferenceState({
                    conversationId,
                    currentModel,
                    currentThinkingLevel,
                    currentServiceTier,
                    hasExplicitServiceTier,
                    defaultModel,
                    defaultThinkingLevel,
                    defaultServiceTier,
                  }),
                  initialDeferredResumeState: {
                    conversationId,
                    resumes: [],
                  },
                  initialPendingPromptState: {
                    conversationId,
                    prompt: initialPrompt,
                  },
                  preserveConversationSurfaceKey: 'draft',
                },
              });
              recordSubmitPhase('afterNavigateReservedConversation', submitStartedAtMs, { conversationId });
              navigatedToCreatedConversation = true;
            },
          });

          const dispatchInitialPromptAfterRoutePaint = () => {
            window.setTimeout(() => {
              void (async () => {
                try {
                  const created = await createdPromise;
                  recordSubmitPhase('createReservedLiveSession', createStartedAtMs, {
                    conversationId: created.id,
                    serverPerf: created.perf ?? null,
                  });
                  setPendingConversationPromptDispatching(newId, true);
                } catch (error) {
                  persistPendingConversationPrompt(newId, initialPrompt);
                  setPendingConversationPromptDispatching(newId, false);
                  setPendingInitialPrompt(initialPrompt);
                  setPendingInitialPromptDispatchingState(false);
                  showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
                }
              })();
            }, 0);
          };

          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(dispatchInitialPromptAfterRoutePaint);
          });

          window.setTimeout(() => {
            clearDraftConversationAttachments();
            clearDraftConversationContextDocs();
            clearDraftConversationCwd();
            clearDraftConversationModelPreferences();
            ensureConversationTabOpen(newId);
          }, 1_000);
        } catch (error) {
          if (createdSessionId) {
            setPendingInitialPromptDispatchingState(false);
          }
          if (createdSessionId && !navigatedToCreatedConversation) {
            await api.destroySession(createdSessionId).catch(() => {});
          }
          setPendingAssistantStatusLabel(null);
          setDraftPendingPrompt(null);
          showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
          await restoreComposerDraft(inputSnapshot, pendingImageAttachments, pendingDrawingAttachments);
          setPendingBrowserComments(pendingBrowserCommentsSnapshot);
        }
        return;
      }

      if (!id) {
        return;
      }

      if (!isLiveSession && !visibleSessionDetail) {
        showNotice('danger', 'Conversation is still loading. Try sending again in a moment.', 4000);
        await restoreComposerDraft(inputSnapshot, pendingImageAttachments, pendingDrawingAttachments);
        setPendingBrowserComments(pendingBrowserCommentsSnapshot);
        return;
      }

      const attachmentRefs = await persistPromptDrawings(id);

      if (isLiveSession) {
        rememberComposerInput(inputSnapshot);
        setPendingAssistantStatusLabel(
          resolveConversationPendingStatusLabel({
            isLiveSession,
            hasVisibleSessionDetail: Boolean(visibleSessionDetail),
          }),
        );

        try {
          const streamSendStartedAtMs = performance.now();
          await stream.send(textToSend, queuedBehavior, promptImages, attachmentRefs, browserContextMessages);
          recordSubmitPhase('streamSend', streamSendStartedAtMs, { conversationId: id, behavior: queuedBehavior });
        } catch (error) {
          if (!isConversationSessionNotLiveError(error)) {
            throw error;
          }

          setConfirmedLive(false);
          stream.reconnect();
          setPendingAssistantStatusLabel('Resuming…');
          const recoveredStreamSendStartedAtMs = performance.now();
          await stream.send(textToSend, queuedBehavior, promptImages, attachmentRefs, browserContextMessages);
          recordSubmitPhase('streamSendAfterReconnect', recoveredStreamSendStartedAtMs, { conversationId: id, behavior: queuedBehavior });
        }

        const refetchAttachmentsStartedAtMs = performance.now();
        await refetchConversationAttachments();
        recordSubmitPhase('refetchConversationAttachments', refetchAttachmentsStartedAtMs, { conversationId: id });

        window.setTimeout(() => {
          scrollToBottom();
        }, 50);
      } else if (visibleSessionDetail) {
        try {
          rememberComposerInput(inputSnapshot);
          setPendingAssistantStatusLabel(
            resolveConversationPendingStatusLabel({
              isLiveSession: false,
              hasVisibleSessionDetail: true,
            }),
          );
          setPendingAssistantStatusLabel('Working…');
          const resumedStreamSendStartedAtMs = performance.now();
          await stream.send(textToSend, queuedBehavior, promptImages, attachmentRefs, browserContextMessages);
          recordSubmitPhase('streamSendSavedConversation', resumedStreamSendStartedAtMs, { conversationId: id, behavior: queuedBehavior });
          const refetchAttachmentsStartedAtMs = performance.now();
          await refetchConversationAttachments();
          recordSubmitPhase('refetchConversationAttachments', refetchAttachmentsStartedAtMs, { conversationId: id });
          window.setTimeout(() => {
            scrollToBottom();
          }, 50);
        } catch (error) {
          console.error('Auto-resume failed:', error);
          setPendingAssistantStatusLabel(null);
          await restoreComposerDraft(inputSnapshot, pendingImageAttachments, pendingDrawingAttachments);
          setPendingBrowserComments(pendingBrowserCommentsSnapshot);
          showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
          addNotification({
            type: 'error',
            message: 'Auto-resume failed',
            details: error instanceof Error ? error.message : String(error),
            source: 'core',
          });
        }
      }
    } catch (error) {
      console.error('Failed to prepare attachments:', error);
      setPendingAssistantStatusLabel(null);
      await restoreComposerDraft(inputSnapshot, pendingImageAttachments, pendingDrawingAttachments);
      setPendingBrowserComments(pendingBrowserCommentsSnapshot);
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
      addNotification({
        type: 'warning',
        message: 'Failed to prepare attachments',
        details: error instanceof Error ? error.message : String(error),
        source: 'core',
      });
    } finally {
      composerSubmitRunningRef.current = false;
    }
  }

  async function submitComposerActionForModifiers(altKeyHeld: boolean) {
    const nextSubmit = resolveConversationComposerSubmitState(
      composerRunState.streamControlsActive,
      altKeyHeld,
      liveSessionHasStaleTurnState,
    );

    await submitComposer(nextSubmit.behavior);
  }

  async function stopStreamAndRestoreQueuedPrompts() {
    setPendingAssistantStatusLabel(null);
    let clearedQueuedPrompts: Awaited<ReturnType<typeof api.clearQueuedMessages>> | null = null;
    let clearQueuedPromptsError: unknown = null;

    if (id && visiblePendingQueue.length > 0) {
      try {
        clearedQueuedPrompts = await api.clearQueuedMessages(id, currentSurfaceId);
      } catch (error) {
        clearQueuedPromptsError = error;
      }
    }

    await streamAbort();
    if (id) {
      const currentRuntime = conversationRuntimeStore.get(id);
      conversationRuntimeStore.apply({
        id,
        running: false,
        revision: (currentRuntime?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      });
    }

    if (clearQueuedPromptsError) {
      showNotice(
        'danger',
        clearQueuedPromptsError instanceof Error ? clearQueuedPromptsError.message : String(clearQueuedPromptsError),
        4000,
      );
      return;
    }

    if (!clearedQueuedPrompts || clearedQueuedPrompts.items.length === 0) return;

    try {
      const cleared = clearedQueuedPrompts;
      const restoredText = cleared.items
        .map((item) => {
          const text = item.text.trim();
          if (!text) return '';
          return item.author === 'agent' ? `[Queued by agent]\n${text}` : text;
        })
        .filter(Boolean)
        .join('\n\n');
      const restoredFiles = cleared.items.flatMap((item, index) => restoreQueuedImageFiles(item.images, item.behavior, index));
      const restoredUpdate = resolveRestoredQueuedPromptComposerUpdate({
        restoredText,
        currentInput: textareaRef.current?.value ?? input,
        restoredFileCount: restoredFiles.length,
      });

      if (restoredUpdate.nextInput !== null) {
        composerController.setText(restoredUpdate.nextInput, { focus: false });
      }
      if (restoredFiles.length > 0) {
        setAttachments((current) => [...restoredFiles, ...current]);
      }
      moveComposerCaretToEnd();

      if (restoredUpdate.hasContent) {
        showNotice(
          'accent',
          cleared.items.length === 1
            ? 'Stopped agent and restored queued prompt to the composer.'
            : `Stopped agent and restored ${cleared.items.length} queued prompts to the composer.`,
        );
      }
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    }
  }

  useEffect(() => {
    setExtensionCommandContext('conversation.isStreaming', stream.isStreaming);
    return () => setExtensionCommandContext('conversation.isStreaming', null);
  }, [stream.isStreaming]);

  async function restoreQueuedPromptToComposer(
    behavior: 'steer' | 'followUp',
    queueIndex: number,
    previewId?: string,
    options: { showSuccessNotice?: boolean } = {},
  ) {
    if (!id || !isLiveSession) {
      showNotice('danger', 'Queued prompts can only be restored from a live session.', 4000);
      return;
    }

    try {
      if (!ensureConversationCanControl('restore queued prompts')) {
        return;
      }

      const restored = await api.restoreQueuedMessage(
        id,
        {
          behavior,
          index: queueIndex,
          ...(previewId ? { previewId } : {}),
        },
        currentSurfaceId,
      );
      const restoredText = typeof restored.text === 'string' ? restored.text : '';
      const restoredFiles = restoreQueuedImageFiles(restored.images, behavior, queueIndex);
      const restoredUpdate = resolveRestoredQueuedPromptComposerUpdate({
        restoredText,
        currentInput: textareaRef.current?.value ?? input,
        restoredFileCount: restoredFiles.length,
      });

      if (!restoredUpdate.hasContent) {
        showNotice('danger', 'Queued prompt had nothing to restore.', 4000);
        return;
      }

      if (restoredUpdate.nextInput !== null) {
        composerController.setText(restoredUpdate.nextInput, { focus: false });
      }
      if (restoredFiles.length > 0) {
        setAttachments((current) => [...restoredFiles, ...current]);
      }

      moveComposerCaretToEnd();
      if (options.showSuccessNotice !== false) {
        showNotice('accent', restoredUpdate.noticeText);
      }
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = readComposerTransferFiles(e.clipboardData.files);
    if (!shouldHandlePastedComposerFiles(files)) {
      return;
    }

    e.preventDefault();
    void addComposerFiles(files);
  }

  function canNavigateComposerHistory(textarea: HTMLTextAreaElement, key: 'ArrowUp' | 'ArrowDown'): boolean {
    return canNavigateComposerHistoryValue({
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      key,
    });
  }

  // Keyboard handling
  async function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = e.currentTarget;
    const composerInput = textarea.value;
    const isComposing = e.nativeEvent.isComposing;
    const clearShortcut = resolveComposerClearShortcut({
      key: e.key,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      isComposing,
      composerInput,
      attachmentCount: attachments.length,
      drawingAttachmentCount: drawingAttachments.length,
    });
    if (clearShortcut.shouldClear || clearShortcut.shouldRememberInput) {
      if (clearShortcut.shouldRememberInput) {
        rememberComposerInput(input);
      }
      if (clearShortcut.shouldClear) {
        e.preventDefault();
        composerController.clear();
        setAttachments([]);
        setDrawingAttachments([]);
      }
      return;
    }

    if (await handleComposerMenuKeyDown(e)) {
      return;
    }

    if (
      shouldRestoreFirstQueuedPromptFromComposerShortcut({
        key: e.key,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        isComposing,
      })
    ) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent(CONVERSATION_RESTORE_FIRST_QUEUED_PROMPT_COMMAND_EVENT));
      return;
    }

    const composerQuestionHotkeyAction = resolveComposerQuestionHotkeyAction({
      key: e.key,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      isComposing,
      hasPendingQuestion: Boolean(pendingAskUserQuestion),
      questionSubmitting: composerQuestionSubmitting,
      composerInputLength: composerInput.length,
      attachmentCount: attachments.length,
      drawingAttachmentCount: drawingAttachments.length,
      activeOptionCount: composerActiveQuestion?.options.length ?? 0,
    });

    if (composerQuestionHotkeyAction.kind !== 'none') {
      if (composerQuestionHotkeyAction.kind === 'moveOption' && composerActiveQuestion) {
        e.preventDefault();
        setComposerQuestionOptionIndex((current) =>
          moveAskUserQuestionIndex(current, composerActiveQuestion.options.length, composerQuestionHotkeyAction.direction),
        );
        return;
      }

      if (composerQuestionHotkeyAction.kind === 'selectOption') {
        if (composerActiveQuestion) {
          e.preventDefault();
          handleComposerQuestionOptionSelect(composerQuestionIndex, composerQuestionHotkeyAction.optionIndex);
        }
        return;
      }

      if (composerQuestionHotkeyAction.kind === 'moveQuestion') {
        const pendingPresentation = pendingAskUserQuestion?.presentation;
        if (!pendingPresentation) {
          return;
        }

        e.preventDefault();
        if (composerQuestionHotkeyAction.direction > 0) {
          if (composerQuestionIndex < pendingPresentation.questions.length - 1) {
            activateComposerQuestion(composerQuestionIndex + 1);
          }
        } else {
          activateComposerQuestion(Math.max(0, composerQuestionIndex - 1));
        }
        return;
      }

      if (composerQuestionHotkeyAction.kind === 'submitOrSelect') {
        e.preventDefault();
        if (composerQuestionCanSubmit) {
          await submitComposerQuestionIfReady();
        } else if (composerActiveQuestion?.options.length) {
          handleComposerQuestionOptionSelect(composerQuestionIndex, composerQuestionOptionIndex);
        }
        return;
      }
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      if (canNavigateComposerHistory(textarea, e.key) && navigateComposerHistory(e.key === 'ArrowUp' ? 'older' : 'newer')) {
        e.preventDefault();
        return;
      }
    }

    if (shouldSubmitComposerFromEnter({ key: e.key, shiftKey: e.shiftKey, isComposing })) {
      e.preventDefault();
      const altKeyHeld = e.altKey || e.nativeEvent.getModifierState('Alt') || composerAltHeld;
      await submitComposerActionForModifiers(altKeyHeld);
    }
  }

  // Drag-and-drop
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(nextDragOverStateForDragOver());
  }
  function handleDragLeave() {
    setDragOver(nextDragOverStateForDragEnd());
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(nextDragOverStateForDragEnd());

    const files = readComposerTransferFiles(e.dataTransfer.files);
    if (shouldHandleDroppedComposerFiles(files)) {
      void addComposerFiles(files);
      return;
    }

    const workspacePath = readDroppedComposerWorkspacePath(e.dataTransfer);
    if (workspacePath) {
      void attachDroppedWorkspacePath(workspacePath);
    }
  }
  function removeAttachment(i: number) {
    setAttachments((prev) => removeComposerImageFileAtIndex(prev, i));
  }

  async function saveAttachedContextDocs(nextDocs: ConversationContextDocRef[]) {
    const normalized = dedupeConversationContextDocs(nextDocs);

    if (draft) {
      setAttachedContextDocs(normalized);
      persistDraftConversationContextDocs(normalized);
      return normalized;
    }

    if (!id) {
      return attachedContextDocs;
    }

    setContextDocsBusy(true);
    try {
      const result = await api.updateConversationContextDocs(id, normalized);
      setAttachedContextDocs(result.attachedContextDocs);
      return result.attachedContextDocs;
    } finally {
      setContextDocsBusy(false);
    }
  }

  async function attachMentionedDocsToConversation(items: Array<MentionItem & { path: string }>) {
    if (items.length === 0) {
      return;
    }

    try {
      await saveAttachedContextDocs(appendMentionedConversationContextDocs(attachedContextDocs, items));
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    }
  }

  async function attachDroppedWorkspacePath(path: string) {
    if (!currentCwd) {
      return;
    }

    try {
      const result = await api.resolveWorkspacePathLinks(currentCwd, [path]);
      const link = result.links.find(
        (candidate) => candidate.input === path || candidate.targetPath === path || candidate.workspacePath === path,
      );
      if (!link || link.kind !== 'workspace' || link.entryKind !== 'file' || !link.workspacePath) {
        return;
      }

      const title = link.workspacePath.split('/').pop()?.trim() || link.workspacePath;
      await attachMentionedDocsToConversation([
        {
          id: `@${link.workspacePath}`,
          label: link.workspacePath,
          kind: 'file',
          title,
          summary: link.workspacePath,
          path: link.workspacePath,
        },
      ]);
    } catch {
      showNotice('danger', 'Could not attach this workspace file. Refresh the workspace and try again.', 4000);
    }
  }

  async function removeAttachedContextDoc(path: string) {
    try {
      await saveAttachedContextDocs(removeConversationContextDocByPath(attachedContextDocs, path));
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    }
  }

  const composerHasContent =
    input.trim().length > 0 || attachments.length > 0 || drawingAttachments.length > 0 || pendingBrowserComments.length > 0;
  const composerShowsQuestionSubmit = shouldShowQuestionSubmitAsPrimaryComposerAction(
    Boolean(pendingAskUserQuestion),
    composerHasContent,
    composerRunState.streamControlsActive,
  );
  const composerCanSubmit =
    !composerDisabled && (composerHasContent || (composerShowsQuestionSubmit && composerQuestionCanSubmit && !composerQuestionSubmitting));
  useEffect(() => {
    setExtensionCommandContext('composer.canSubmit', composerCanSubmit);
    return () => setExtensionCommandContext('composer.canSubmit', null);
  }, [composerCanSubmit]);
  useEffect(() => {
    setExtensionCommandContext('composer.canClear', composerHasContent);
    return () => setExtensionCommandContext('composer.canClear', null);
  }, [composerHasContent]);
  useEffect(() => {
    const handleComposerFocusCommand = () => {
      textareaRef.current?.focus();
    };

    const handleComposerSubmitCommand = () => {
      if (composerShowsQuestionSubmit) {
        void submitComposerQuestionIfReady();
        return;
      }
      void submitComposerActionForModifiers(false);
    };

    const handleComposerClearCommand = () => {
      composerController.clear();
      textareaRef.current?.focus();
    };

    const handleComposerStopCommand = () => {
      if (!stream.isStreaming) return;
      void stopStreamAndRestoreQueuedPrompts();
    };

    const handleComposerAppendTextCommand = (event: Event) => {
      const text = event instanceof CustomEvent && typeof event.detail?.text === 'string' ? event.detail.text : '';
      if (!text.trim()) return;
      composerController.appendText(text);
    };

    window.addEventListener('neon-pilot:composer-focus', handleComposerFocusCommand);
    window.addEventListener('neon-pilot:composer-submit', handleComposerSubmitCommand);
    window.addEventListener('neon-pilot:composer-stop', handleComposerStopCommand);
    window.addEventListener('neon-pilot:composer-clear', handleComposerClearCommand);
    window.addEventListener('neon-pilot:composer-append-text', handleComposerAppendTextCommand);
    return () => {
      window.removeEventListener('neon-pilot:composer-focus', handleComposerFocusCommand);
      window.removeEventListener('neon-pilot:composer-submit', handleComposerSubmitCommand);
      window.removeEventListener('neon-pilot:composer-stop', handleComposerStopCommand);
      window.removeEventListener('neon-pilot:composer-clear', handleComposerClearCommand);
      window.removeEventListener('neon-pilot:composer-append-text', handleComposerAppendTextCommand);
    };
  }, [
    composerController,
    composerShowsQuestionSubmit,
    stopStreamAndRestoreQueuedPrompts,
    stream.isStreaming,
    submitComposerQuestionIfReady,
    submitComposerActionForModifiers,
  ]);
  const composerSubmit = resolveConversationComposerSubmitState(
    composerRunState.streamControlsActive,
    composerAltHeld,
    liveSessionHasStaleTurnState,
  );
  const showScrollToBottomControl = shouldShowScrollToBottomControl(messageCount, atBottom);
  const renameConversationDisabled =
    conversationNeedsTakeover ||
    isEditingTitle ||
    titleSaving ||
    conversationCwdEditorOpen ||
    conversationCwdBusy ||
    conversationCwdPickBusy;
  const { composerShelves, conversationHeaderElements, newConversationPanels } = extensionRegistry;
  const lifecycleEvent = resolveConversationLifecycleEvent({
    hasSessionError: Boolean(sessionError),
    hasPendingAskUserQuestion: Boolean(pendingAskUserQuestion),
    conversationNeedsTakeover,
    goalActive: stream.goalState?.status === 'active',
    isCompacting: stream.isCompacting,
    conversationRunningForPage,
  });
  const conversationLifecycleElements = useMemo(
    () => filterConversationLifecycleElements(extensionRegistry.conversationLifecycle, lifecycleEvent),
    [extensionRegistry.conversationLifecycle, lifecycleEvent],
  );
  const conversationLifecycleContext = useMemo(
    () =>
      buildConversationLifecycleContext({
        lifecycleEvent,
        conversationId: id,
        cwd: currentCwd,
        isStreaming: conversationRunningForPage,
        hasGoal: stream.goalState?.status === 'active',
        isCompacting: stream.isCompacting,
        error: sessionError,
      }),
    [conversationRunningForPage, currentCwd, id, lifecycleEvent, sessionError, stream.goalState?.status, stream.isCompacting],
  );
  const { top: composerShelvesTop, bottom: composerShelvesBottom } = useMemo(
    () => splitComposerShelvesByPlacement(composerShelves),
    [composerShelves],
  );
  const suggestedContextShelfState = useMemo(
    () =>
      buildSuggestedContextShelfState({
        query: debouncedRelatedThreadsQuery,
        results: visibleRelatedThreadResults,
        selectedSessionIds: selectedRelatedThreadIds,
        autoSelectedSessionIds: autoSelectedRelatedThreadIds,
        loading: relatedThreadSearchLoading,
        busy: preparingRelatedThreadContext,
        error: relatedThreadSearchError,
        maxSelections: MAX_RELATED_THREAD_SELECTIONS,
        hotkeyLimit: MAX_RELATED_THREAD_HOTKEYS,
        onToggle: toggleRelatedThreadSelection,
      }),
    [
      autoSelectedRelatedThreadIds,
      debouncedRelatedThreadsQuery,
      preparingRelatedThreadContext,
      relatedThreadSearchError,
      relatedThreadSearchLoading,
      selectedRelatedThreadIds,
      toggleRelatedThreadSelection,
      visibleRelatedThreadResults,
    ],
  );
  const composerShelfContext = useMemo(
    () => buildComposerShelfContext({ conversationId: id, isStreaming: conversationRunningForPage, isLive: isLiveSession }),
    [conversationRunningForPage, id, isLiveSession],
  );
  const newConversationPanelContext = useMemo(
    () => buildNewConversationPanelContext({ conversationId: id, suggestedContext: suggestedContextShelfState }),
    [id, suggestedContextShelfState],
  );
  const [composerChromeReady, setComposerChromeReady] = useState(draft);
  const [composerShelvesReady, setComposerShelvesReady] = useState(draft);
  const composerChromeConversationKeyRef = useRef<string | null>(draft ? 'draft' : (id ?? null));

  useEffect(() => {
    const conversationKey = draft ? 'draft' : (id ?? null);
    if (composerChromeConversationKeyRef.current !== conversationKey) {
      composerChromeConversationKeyRef.current = conversationKey;
      setComposerChromeReady(draft);
      setComposerShelvesReady(draft);
    }

    if (draft) {
      setComposerChromeReady(true);
      setComposerShelvesReady(true);
      return;
    }

    if (!shouldPrepareConversationComposerChrome({ draft, conversationId: id, composerChromeReady, showConversationLoadingState })) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setComposerChromeReady(true);
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [composerChromeReady, draft, id, showConversationLoadingState]);

  useEffect(() => {
    if (composerShelvesReady) return;
    if (!shouldMountComposerShelvesImmediately({ draft, composerChromeReady, showConversationLoadingState })) return;
    setComposerShelvesReady(true);
  }, [composerChromeReady, composerShelvesReady, draft, showConversationLoadingState]);

  const hasComposerShelfContent =
    composerShelvesReady &&
    hasConversationComposerShelfContent({
      composerShelvesTopCount: composerShelvesTop.length,
      composerShelvesBottomCount: composerShelvesBottom.length,
      attachedContextDocsCount: attachedContextDocs.length,
      draftMentionItemsCount: draftMentionItems.length,
      pendingQueueCount: visiblePendingQueue.length,
      draft,
      orderedDeferredResumesCount: orderedDeferredResumes.length,
      scheduledTasksCount: conversationScheduledTasks.length,
      backgroundExecutionsCount: visibleActiveConversationBackgroundExecutions.length,
      pendingBrowserCommentsCount: pendingBrowserComments.length,
      hasActiveQuestion: Boolean(pendingAskUserQuestion && composerActiveQuestion),
    });
  const composerAttachmentProviders = extensionRegistry.composerAttachmentProviders;
  const composerAttachmentProviderClientsRef = useRef<Map<string, ReturnType<typeof createNativeExtensionClient>>>(new Map());
  const invokeComposerAttachmentProvider = useCallback(
    async (provider: (typeof composerAttachmentProviders)[number]) => {
      let client = composerAttachmentProviderClientsRef.current.get(provider.extensionId);
      if (!client) {
        client = createNativeExtensionClient(provider.extensionId);
        composerAttachmentProviderClientsRef.current.set(provider.extensionId, client);
      }
      const result = await client.extension.invoke(provider.action, {
        conversationId: id ?? null,
        cwd: currentCwd ?? null,
        composerText: input,
      });
      if (typeof result === 'string' && result.trim()) composerController.setText(input ? `${input}\n${result}` : result);
      if (result && typeof result === 'object' && 'text' in result && typeof result.text === 'string' && result.text.trim()) {
        composerController.setText(input ? `${input}\n${result.text}` : result.text);
      }
    },
    [composerAttachmentProviders, composerController, currentCwd, id, input],
  );
  const hasComposerAttachmentShelfContent =
    attachments.length > 0 ||
    drawingAttachments.length > 0 ||
    drawingsBusy ||
    Boolean(drawingsError) ||
    composerAttachmentProviders.length > 0;
  const keyboardOpen = keyboardInset > 120;
  const conversationPerformanceMode = resolveConversationPerformanceMode({
    messageCount: realMessages?.length ?? 0,
  });
  const visibleTranscriptState =
    hasRenderableMessages && realMessages
      ? {
          conversationId: id ?? 'draft-conversation',
          messages: realMessages,
          historicalBlockOffset,
          historicalTotalBlocks,
        }
      : showConversationLoadingState && !draft
        ? stableTranscriptState
        : null;
  const visibleTranscriptMessages = visibleTranscriptState?.messages;
  const visibleTranscriptMessageIndexOffset = visibleTranscriptState?.historicalBlockOffset ?? 0;
  const visibleTranscriptTotalBlocks = visibleTranscriptState?.historicalTotalBlocks ?? 0;
  visibleTranscriptActionStateRef.current =
    visibleTranscriptState?.conversationId && visibleTranscriptState.messages.length > 0
      ? {
          conversationId: visibleTranscriptState.conversationId,
          messages: visibleTranscriptState.messages,
          historicalBlockOffset: visibleTranscriptState.historicalBlockOffset,
        }
      : null;
  const visibleTranscriptRenderItems = useMemo(
    () =>
      visibleSessionDetail?.renderItems &&
      visibleTranscriptMessages &&
      !draft &&
      !pendingInitialPrompt &&
      !stream.hasSnapshot &&
      visibleStreamBlocks.length === 0 &&
      visibleTranscriptMessageIndexOffset === visibleSessionDetail.blockOffset
        ? hydrateTranscriptRenderItems(visibleSessionDetail.renderItems, hydratedHistoricalBlocks, hydratedHistoricalEntryClusters)
        : undefined,
    [
      draft,
      hydratedHistoricalBlocks,
      hydratedHistoricalEntryClusters,
      pendingInitialPrompt,
      stream.hasSnapshot,
      visibleSessionDetail,
      visibleStreamBlocks.length,
      visibleTranscriptMessageIndexOffset,
      visibleTranscriptMessages,
    ],
  );
  const visibleTranscriptCount = visibleTranscriptMessages?.length ?? 0;
  const visibleTranscriptHasOlderBlocks = shouldShowEarlierTranscriptBoundary({
    hasOlderBlocks:
      !showConversationLoadingState && !draft && Boolean(id) && visibleTranscriptState?.conversationId === id && showHistoricalLoadMore,
    visibleMessages: visibleTranscriptMessages,
  });
  const visibleTranscriptAnchoredToTail =
    !showConversationLoadingState &&
    !draft &&
    Boolean(id) &&
    visibleTranscriptState?.conversationId === id &&
    Boolean(visibleSessionDetail) &&
    !stream.hasSnapshot;
  const { startPercent: visibleTranscriptStartPercent, endPercent: visibleTranscriptEndPercent } = resolveTranscriptWindowPercent({
    blockOffset: visibleTranscriptMessageIndexOffset,
    visibleBlockCount: visibleTranscriptCount,
    totalBlocks: visibleTranscriptTotalBlocks,
    anchoredToTail: visibleTranscriptAnchoredToTail,
  });
  const previousTranscriptPercent = Math.min(HISTORICAL_TAIL_BLOCKS_STEP_PERCENT, Math.max(1, visibleTranscriptStartPercent));
  const previousTranscriptBlockStep = Math.max(1, Math.ceil((visibleTranscriptTotalBlocks * previousTranscriptPercent) / 100));
  const renderingStaleTranscript = Boolean(visibleTranscriptState?.conversationId && id && visibleTranscriptState.conversationId !== id);
  const transcriptPathLinkTargets = useMemo(
    () => collectTranscriptPathCandidateTargets(visibleTranscriptMessages),
    [visibleTranscriptMessages],
  );
  const [resolvedTranscriptPathLinks, setResolvedTranscriptPathLinks] = useState<WorkspaceResolvedPathLink[]>([]);
  useEffect(() => {
    if (!currentCwd || transcriptPathLinkTargets.length === 0) {
      setResolvedTranscriptPathLinks([]);
      return;
    }

    let cancelled = false;
    api
      .resolveWorkspacePathLinks(currentCwd, transcriptPathLinkTargets)
      .then((result) => {
        if (!cancelled) {
          setResolvedTranscriptPathLinks(result.links);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedTranscriptPathLinks([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentCwd, transcriptPathLinkTargets]);
  const resolvedTranscriptPathLinksByTarget = useMemo(() => {
    const linksByTarget = new Map<string, WorkspaceResolvedPathLink>();
    for (const link of resolvedTranscriptPathLinks) {
      linksByTarget.set(link.targetPath, link);
    }
    return linksByTarget;
  }, [resolvedTranscriptPathLinks]);
  const validatedTranscriptPathTargets = useMemo(
    () => new Set(resolvedTranscriptPathLinksByTarget.keys()),
    [resolvedTranscriptPathLinksByTarget],
  );
  const openTranscriptFilePath = useCallback(
    (path: string) => {
      const knowledgeMarker = '/knowledge-base/repo/';
      const knowledgeMarkerIndex = path.indexOf(knowledgeMarker);
      if (knowledgeMarkerIndex >= 0) {
        openKnowledgeFilePath(path.slice(knowledgeMarkerIndex + knowledgeMarker.length));
        return;
      }

      const link = resolvedTranscriptPathLinksByTarget.get(normalizeTranscriptPathTarget(path));
      if (!link) {
        return;
      }

      if (transcriptPathLinkTarget === 'desktop' || !link.workspacePath) {
        void getDesktopBridge()?.openPath?.(link.openPath);
        return;
      }

      setAppLayoutMode('workbench');
      writeAppLayoutMode('workbench');
      window.dispatchEvent(new CustomEvent(WORKBENCH_OPEN_WORKSPACE_FILE_EVENT, { detail: { path: link.workspacePath } }));
    },
    [openKnowledgeFilePath, resolvedTranscriptPathLinksByTarget, transcriptPathLinkTarget],
  );
  const showInlineConversationLoadingState = shouldShowConversationInlineLoadingState({
    showConversationLoadingState,
    hasVisibleTranscript: Boolean(visibleTranscriptMessages?.length),
  });
  const showBlockingConversationLoadingState = showConversationLoadingState && !showInlineConversationLoadingState;
  const newConversationSetupAction = showNewConversationSetup ? (
    <ConversationDraftEmptyAction
      hasDraftCwd={draft ? hasDraftCwd : currentCwdLabel !== 'Chat'}
      draftCwdValue={draft ? draftCwdValue : currentCwdLabel === 'Chat' ? '' : (currentCwd ?? '')}
      draftCwdError={draft ? draftCwdError : conversationCwdError}
      draftCwdPickBusy={draft ? draftCwdPickBusy : conversationCwdPickBusy || conversationCwdBusy}
      savedWorkspacePathsLoading={savedWorkspacePathsLoading}
      availableDraftWorkspacePaths={availableDraftWorkspacePaths}
      onClearDraftCwdSelection={() => {
        if (draft) {
          clearDraftConversationCwdSelection();
          return;
        }
        void submitConversationCwdChange(null);
      }}
      onSelectDraftWorkspace={(workspacePath) => {
        if (draft) {
          selectDraftConversationWorkspace(workspacePath);
          return;
        }
        void submitConversationCwdChange(workspacePath);
      }}
      onPickDraftCwd={() => {
        if (draft) {
          void pickDraftConversationCwd();
          return;
        }
        void pickLiveSetupConversationCwd();
      }}
      extensionPanels={newConversationPanels.map((panel) => (
        <NewConversationPanelHost
          key={`${panel.extensionId}:${panel.id}`}
          registration={panel}
          panelContext={newConversationPanelContext}
        />
      ))}
    />
  ) : undefined;

  useEffect(() => {
    if (!id || draft || showConversationLoadingState) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      completeConversationOpenPhase(id, 'content', {
        renderState: hasRenderableMessages ? 'messages' : sessionError ? 'error' : 'empty',
        messageCount: realMessages?.length ?? 0,
        sessionLoading,
        isLiveSession,
        hasStreamSnapshot: stream.hasSnapshot,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    draft,
    hasRenderableMessages,
    id,
    isLiveSession,
    realMessages?.length,
    sessionError,
    sessionLoading,
    showConversationLoadingState,
    stream.hasSnapshot,
  ]);

  const transcriptPane = useMemo(
    () => (
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="conversation-scroll-shell h-full overflow-y-auto overflow-x-hidden"
          data-conversation-scroll-shell="1"
          data-conversation-id={id ?? 'draft'}
          data-historical-tail-blocks={historicalTailBlocks}
          data-historical-total-blocks={historicalTotalBlocks}
          data-visible-message-count={visibleTranscriptMessages?.length ?? 0}
          style={{ scrollPaddingTop: `${conversationHeaderOffset + 16}px` }}
        >
          <div
            ref={conversationHeaderRef}
            className="conversation-header sticky top-0 z-30 bg-base/90 px-4 pt-5 backdrop-blur sm:px-6 lg:px-10"
          >
            <div className="conversation-header-content mx-auto w-full max-w-6xl pb-4 pt-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 max-w-4xl">
                  {isEditingTitle && !draft ? (
                    <form
                      className="-ml-3 flex max-w-4xl items-center gap-2 pr-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveTitleEdit();
                      }}
                    >
                      <TextInput
                        ref={titleInputRef}
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelTitleEdit();
                            return;
                          }
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void saveTitleEdit();
                          }
                        }}
                        onBlur={() => {
                          void saveTitleEdit();
                        }}
                        placeholder="Name this conversation"
                        className="ui-conversation-title-input !border-transparent !bg-transparent !px-3 !py-1.5 !text-[2rem] !font-[650] !leading-[1.08] hover:!bg-base/35 focus:!bg-base/35"
                        disabled={titleSaving}
                      />
                      <IconButton
                        shape="circle"
                        size="sm"
                        className="h-8 w-8 text-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={cancelTitleEdit}
                        disabled={titleSaving}
                        title="Cancel title edit"
                        aria-label="Cancel title edit"
                      >
                        <svg
                          width="17"
                          height="17"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m18 6-12 12" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </IconButton>
                    </form>
                  ) : draft ? (
                    <h1 className="ui-conversation-title-clamp ui-conversation-title-display max-w-4xl break-words pr-4">{title}</h1>
                  ) : (
                    <Suspense fallback={<h1 className="ui-conversation-title-clamp ui-conversation-title-display">{title}</h1>}>
                      <ConversationSavedHeader title={title} onTitleClick={!renameConversationDisabled ? beginTitleEdit : undefined} />
                    </Suspense>
                  )}
                </div>
              </div>
              {conversationHeaderElements.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  {conversationHeaderElements.map((element) => (
                    <ConversationHeaderHost key={`${element.extensionId}:${element.id}`} registration={element} />
                  ))}
                </div>
              )}
              {conversationLifecycleContext && conversationLifecycleElements.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {conversationLifecycleElements.map((element) => (
                    <ConversationLifecycleHost
                      key={`${element.extensionId}:${element.id}`}
                      registration={element}
                      lifecycleContext={conversationLifecycleContext}
                    />
                  ))}
                </div>
              ) : null}
              {visibleConversationBootstrap?.integrityWarning && (
                <Notice tone="warning" className="mt-1 py-1.5">
                  Session file was modified outside the agent. Some context may be stale.
                </Notice>
              )}
            </div>
          </div>
          {showBlockingConversationLoadingState ? (
            <CenteredLoadingState label="Loading messages…" className="h-full flex-1" />
          ) : visibleTranscriptMessages ? (
            <Suspense fallback={<CenteredLoadingState label="Loading messages…" className="h-full flex-1" />}>
              <ChatView
                key={visibleTranscriptState?.conversationId ?? id ?? 'draft-conversation'}
                conversationId={visibleTranscriptState?.conversationId ?? id ?? null}
                messages={visibleTranscriptMessages}
                precomputedRenderItems={visibleTranscriptRenderItems}
                systemPrompt={isLiveSession ? stream.systemPrompt : null}
                toolDefinitions={isLiveSession ? stream.toolDefinitions : EMPTY_TOOL_DEFINITIONS}
                remoteControlled={Boolean(
                  (visibleTranscriptState?.conversationId ?? id) &&
                  remoteControlledConversationIds.includes((visibleTranscriptState?.conversationId ?? id) as string),
                )}
                messageIndexOffset={visibleTranscriptMessageIndexOffset}
                scrollContainerRef={scrollRef}
                focusMessageIndex={renderingStaleTranscript ? null : requestedFocusMessageIndex}
                isStreaming={renderingStaleTranscript ? false : conversationRunningForPage}
                isCompacting={renderingStaleTranscript ? false : stream.isCompacting}
                pendingStatusLabel={renderingStaleTranscript ? null : displayedPendingAssistantStatusLabel}
                performanceMode={conversationPerformanceMode}
                onForkMessage={
                  shouldEnableMessageForkControls({ renderingStaleTranscript, conversationId: id })
                    ? forkConversationFromMessage
                    : undefined
                }
                onRewindMessage={!renderingStaleTranscript && id && !conversationRunningForPage ? rewindConversationFromMessage : undefined}
                onEditUserMessage={
                  !renderingStaleTranscript && id && !conversationRunningForPage ? editConversationFromUserMessage : undefined
                }
                onReplyToSelection={renderingStaleTranscript ? undefined : handleReplyToSelection}
                selectionActions={renderingStaleTranscript ? undefined : extensionRegistry.selectionActions}
                onHydrateMessage={renderingStaleTranscript ? undefined : hydrateHistoricalBlock}
                hydratingMessageBlockIds={renderingStaleTranscript ? undefined : hydratingHistoricalBlockIdSet}
                onOpenArtifact={renderingStaleTranscript ? undefined : openArtifact}
                activeArtifactId={renderingStaleTranscript ? null : selectedArtifactId}
                onOpenCheckpoint={renderingStaleTranscript ? undefined : openCheckpoint}
                activeCheckpointId={renderingStaleTranscript ? null : selectedCheckpointId}
                onOpenBrowser={renderingStaleTranscript ? undefined : openWorkbenchBrowser}
                onOpenFilePath={renderingStaleTranscript ? undefined : openTranscriptFilePath}
                validatedFilePathTargets={renderingStaleTranscript ? undefined : validatedTranscriptPathTargets}
                onSubmitAskUserQuestion={renderingStaleTranscript ? undefined : submitAskUserQuestion}
                askUserQuestionDisplayMode="composer"
                onResumeConversation={renderingStaleTranscript || !conversationResumeState.canResume ? undefined : resumeConversation}
                onFocusComposerRequest={focusComposerFromTranscriptBackground}
                resumeConversationBusy={renderingStaleTranscript ? false : resumeConversationBusy}
                resumeConversationTitle={renderingStaleTranscript ? undefined : conversationResumeState.title}
                resumeConversationLabel={conversationResumeState.actionLabel ?? 'continue'}
                windowingHeaderContent={
                  visibleTranscriptHasOlderBlocks ? (
                    <div className="relative my-2 flex items-center gap-3 py-3 text-[11px] text-secondary/80">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border-subtle to-border-subtle" aria-hidden />
                      <div className="ui-conversation-status-strip">
                        <span>Earlier conversation hidden</span>
                        <span className="text-dim" aria-hidden>
                          ·
                        </span>
                        <span>
                          Viewing {visibleTranscriptStartPercent}–{visibleTranscriptEndPercent}%
                        </span>
                        <span className="text-dim" aria-hidden>
                          ·
                        </span>
                        <TextButton
                          onClick={() => loadOlderMessages(undefined, { tailBlockStep: previousTranscriptBlockStep })}
                          disabled={sessionLoading}
                          className="font-medium text-accent hover:text-primary disabled:pointer-events-none disabled:text-secondary/60"
                        >
                          {sessionLoading ? 'Loading earlier…' : `Load previous ${previousTranscriptPercent}%`}
                        </TextButton>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border-subtle to-border-subtle" aria-hidden />
                    </div>
                  ) : undefined
                }
                anchorWindowingToTail={atBottom || autoAnchorTranscriptTail}
                bottomPaddingPx={transcriptBottomPaddingPx}
              />
            </Suspense>
          ) : (
            <AppPageEmptyState
              align={showNewConversationSetup ? 'start' : 'center'}
              className={showNewConversationSetup ? 'ui-conversation-setup-empty px-4 sm:px-6' : undefined}
              contentClassName={showNewConversationSetup ? `${DRAFT_EMPTY_STATE_CONTENT_WIDTH_CLASS} text-left` : undefined}
              icon={
                showNewConversationSetup ? undefined : (
                  <div className="ui-empty-state-icon-accent">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-accent"
                    >
                      <path d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                    </svg>
                  </div>
                )
              }
              title={
                showNewConversationSetup ? (
                  <span className="sr-only">Choose a workspace</span>
                ) : isLiveSession ? (
                  'No messages yet'
                ) : (
                  'This conversation is empty'
                )
              }
              body={
                showNewConversationSetup
                  ? undefined
                  : isLiveSession
                    ? 'This conversation is live but has no messages yet. Send a prompt to get started.'
                    : 'Send a message in Neon Pilot to start this conversation.'
              }
              action={newConversationSetupAction}
            />
          )}
        </div>
        {!showConversationLoadingState && showScrollToBottomControl && (
          <TextButton
            onClick={() => {
              scrollToBottom({ behavior: 'smooth', force: true });
            }}
            className="conversation-scroll-to-bottom absolute bottom-4 left-1/2 z-20 -translate-x-1/2 ui-pill ui-pill-muted shadow-md"
          >
            ↓ scroll to bottom
          </TextButton>
        )}
        {showInlineConversationLoadingState && (
          <div className="ui-composer-bottom-fade">
            <LoadingState label={renderingStaleTranscript ? 'Loading new messages…' : 'Loading messages…'} className="justify-center" />
          </div>
        )}
      </div>
    ),
    [
      conversationResumeState.actionLabel,
      conversationResumeState.canResume,
      conversationResumeState.title,
      draft,
      draftCwdError,
      draftCwdPickBusy,
      draftCwdValue,
      forkConversationFromMessage,
      focusComposerFromTranscriptBackground,
      hasDraftCwd,
      hasRenderableMessages,
      hydrateHistoricalBlock,
      hydratingHistoricalBlockIdSet,
      id,
      isLiveSession,
      jumpToMessage,
      loadOlderMessages,
      openArtifact,
      openCheckpoint,
      openTranscriptFilePath,
      displayedPendingAssistantStatusLabel,
      realMessages,
      renderingStaleTranscript,
      requestedFocusMessageIndex,
      resumeConversation,
      resumeConversationBusy,
      editConversationFromUserMessage,
      rewindConversationFromMessage,
      selectedArtifactId,
      selectedCheckpointId,
      sessionLoading,
      showConversationLoadingState,
      showInlineConversationLoadingState,
      showNewConversationSetup,
      showScrollToBottomControl,
      stream.isCompacting,
      conversationRunningForPage,
      conversationPerformanceMode,
      submitAskUserQuestion,
      visibleTranscriptStartPercent,
      visibleTranscriptEndPercent,
      previousTranscriptPercent,
      previousTranscriptBlockStep,
      availableConversationWorkspacePaths,
      availableDraftWorkspacePaths,
      clearDraftConversationCwdSelection,
      pickDraftConversationCwd,
      savedWorkspacePathsLoading,
      selectDraftConversationWorkspace,
      beginTitleEdit,
      cancelConversationCwdEdit,
      cancelTitleEdit,
      conversationCwdBusy,
      conversationCwdDraft,
      conversationCwdError,
      conversationCwdPickBusy,
      conversationHeaderOffset,
      currentCwd,
      isEditingTitle,
      renameConversationDisabled,
      saveTitleEdit,
      submitConversationCwdChange,
      title,
      titleDraft,
      titleSaving,
      transcriptBottomPaddingPx,
      validatedTranscriptPathTargets,
      visibleTranscriptHasOlderBlocks,
      visibleTranscriptMessageIndexOffset,
      visibleTranscriptMessages,
      visibleTranscriptRenderItems,
      visibleTranscriptState?.conversationId,
      newConversationPanelContext,
      newConversationPanels,
      newConversationSetupAction,
    ],
  );

  const missingConversation = shouldShowMissingConversationState({
    draft,
    conversationId: id,
    sessionsLoaded,
    confirmedLive,
    sessionLoading,
    hasAuthoritativeSessionSnapshot: Boolean(sessionSnapshot),
    hasVisibleSessionDetail: Boolean(visibleSessionDetail),
    hasSavedConversationSessionFile: Boolean(savedConversationSessionFile),
    hasPendingInitialPrompt: Boolean(pendingInitialPrompt),
  });

  useEffect(() => {
    if (!missingConversation || !id) {
      return;
    }

    forgetConversationTab(id);
  }, [id, missingConversation]);

  if (missingConversation) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader className="gap-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="ui-page-title truncate">Conversation not found</h1>
          </div>
        </PageHeader>
        <EmptyState
          className="h-full flex flex-col justify-center px-8"
          title="Conversation not found"
          body={sessionError ?? 'This conversation no longer exists or the live session has ended.'}
          action={
            <Link to="/conversations/new" className="ui-action-button">
              Start a new conversation
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="conversation-page-shell flex h-full flex-col overflow-hidden">
      {transcriptPane}
      {/* Input area */}
      {!keyboardOpen && (
        <ConversationComposer
          className={`conversation-composer-region bg-gradient-to-t from-base via-base to-transparent px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-colors sm:px-6 lg:px-10 ${dragOver ? 'bg-accent/5' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          dragOver={dragOver}
          hasInteractiveOverlay={showModelPicker || showSlash || showMention}
          streamIsStreaming={composerRunState.streamControlsActive}
          shellRef={composerShellRef}
          shellClassName={undefined}
          notice={notice}
          childrenClassName="conversation-composer-inner relative mx-auto w-full max-w-6xl"
          dragOverlay={
            dragOver ? (
              <div className="px-4 py-3 text-center text-[12px] text-accent border-b border-accent/20">📎 Drop files to attach</div>
            ) : null
          }
          menus={
            <>
              {showSlash && (
                <SlashMenu
                  items={slashItems}
                  idx={slashIdx}
                  onSelect={(item) => {
                    void handleComposerSlashMenuSelect(item);
                  }}
                />
              )}
              {showMention && (
                <MentionMenu
                  items={mentionItems}
                  query={mentionQuery}
                  idx={mentionIdx}
                  onSelect={(id) => {
                    void handleComposerMentionSelect(id, input);
                  }}
                />
              )}
              {showModelPicker && (
                <ModelPicker
                  models={modelItems}
                  allModels={models}
                  currentModel={currentModel}
                  query={modelQuery}
                  idx={modelIdx}
                  onSelect={selectModel}
                  onClose={() => {
                    composerController.clear();
                    moveComposerCaretToEnd();
                  }}
                />
              )}
            </>
          }
          shelves={
            <>
              {hasComposerAttachmentShelfContent && (
                <div className="mb-2 max-h-[min(34vh,20rem)] overflow-y-auto overscroll-contain">
                  {composerAttachmentProviders.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {composerAttachmentProviders.map((provider) => (
                        <ToolbarButton
                          key={`${provider.extensionId}:${provider.id}`}
                          className="px-2 py-1 text-[11px]"
                          onClick={() => {
                            void invokeComposerAttachmentProvider(provider);
                          }}
                        >
                          {provider.icon ? <span aria-hidden="true">{provider.icon}</span> : null}
                          <span>{provider.title}</span>
                        </ToolbarButton>
                      ))}
                    </div>
                  ) : null}
                  <ComposerAttachmentShelf
                    attachments={attachments}
                    drawingAttachments={drawingAttachments}
                    drawingsBusy={drawingsBusy}
                    drawingsError={drawingsError}
                    onRemoveAttachment={removeAttachment}
                    onEditDrawing={editDrawing}
                    onRemoveDrawingAttachment={removeDrawingAttachment}
                  />
                </div>
              )}

              {composerChromeReady ? (
                <ConversationGoalPanel goal={stream.goalState} onCancel={() => void cancelConversationGoal()} />
              ) : null}

              {hasComposerShelfContent ? (
                <div className="max-h-[min(34vh,20rem)] overflow-y-auto overscroll-contain">
                  {composerShelvesTop.map((shelf) => (
                    <ComposerShelfHost key={`${shelf.extensionId}:${shelf.id}`} registration={shelf} shelfContext={composerShelfContext} />
                  ))}
                  {pendingBrowserComments.length > 0 ? (
                    <div className="border-b border-border-subtle/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <SectionLabel tone="muted">Browser comments</SectionLabel>
                        <ToolbarButton className="px-2 py-1 text-[11px]" onClick={() => setPendingBrowserComments([])}>
                          Clear
                        </ToolbarButton>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {pendingBrowserComments.map((entry) => (
                          <div key={entry.id} className="ui-browser-comment-chip group">
                            <span className="max-w-[26rem] truncate text-primary">{formatBrowserCommentTargetLabel(entry.target)}</span>
                            <span className="max-w-[20rem] truncate">{entry.comment}</span>
                            <IconButton
                              compact
                              size="sm"
                              className="ml-1"
                              aria-label="Remove browser comment"
                              title="Remove browser comment"
                              onClick={() => setPendingBrowserComments((current) => current.filter((comment) => comment.id !== entry.id))}
                            >
                              ×
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <Suspense fallback={null}>
                    <ConversationContextShelf
                      attachedContextDocs={attachedContextDocs}
                      draftMentionItems={draftMentionItems}
                      unattachedDraftMentionItems={unattachedDraftMentionItems}
                      contextDocsBusy={contextDocsBusy}
                      onRemoveAttachedContextDoc={(path) => {
                        void removeAttachedContextDoc(path);
                      }}
                      onAttachMentionedDocs={(items) => {
                        void attachMentionedDocsToConversation(items);
                      }}
                    />
                  </Suspense>

                  <Suspense fallback={null}>
                    <ConversationQueueShelf
                      pendingQueue={visiblePendingQueue}
                      conversationNeedsTakeover={conversationNeedsTakeover}
                      onRestoreQueuedPrompt={(behavior, queueIndex, previewId) => {
                        void restoreQueuedPromptToComposer(behavior, queueIndex, previewId);
                      }}
                    />
                  </Suspense>
                </div>
              ) : null}

              {!draft && (
                <Suspense fallback={null}>
                  <ConversationActivityShelf
                    backgroundExecutions={visibleActiveConversationBackgroundExecutions}
                    backgroundExecutionIndicatorText={backgroundExecutionIndicatorText}
                    showBackgroundRunDetails={showActiveBackgroundRunDetails}
                    cancellingBackgroundRunIds={cancellingBackgroundRunIds}
                    onToggleBackgroundRunDetails={() => {
                      setShowBackgroundRunDetails((open) => !open);
                    }}
                    onCancelBackgroundRun={cancelBackgroundRunFromShelf}
                    onOpenBackgroundRun={openRun}
                    scheduledTasks={conversationScheduledTasks}
                    scheduledTaskIndicatorText={scheduledTaskIndicatorText}
                    showScheduledTaskDetails={showScheduledTaskDetails}
                    onToggleScheduledTaskDetails={() => {
                      setShowScheduledTaskDetails((open) => !open);
                    }}
                    onRunScheduledTaskNow={(taskId) => {
                      void runScheduledTaskFromShelf(taskId);
                    }}
                    onOpenScheduledTask={openScheduledTask}
                    deferredResumes={orderedDeferredResumes}
                    deferredResumeIndicatorText={deferredResumeIndicatorText}
                    deferredResumeNowMs={deferredResumeNowMs}
                    hasReadyDeferredResumes={hasReadyDeferredResumes}
                    isLiveSession={isLiveSession}
                    deferredResumesBusy={deferredResumesBusy}
                    showDeferredResumeDetails={showDeferredResumeDetails}
                    onContinueDeferredResumesNow={() => {
                      void continueDeferredResumesNow();
                    }}
                    onToggleDeferredResumeDetails={() => {
                      setShowDeferredResumeDetails((open) => !open);
                    }}
                    onFireDeferredResumeNow={(resumeId) => {
                      void fireDeferredResumeNow(resumeId);
                    }}
                    onCancelDeferredResume={(resumeId) => {
                      void cancelDeferredResume(resumeId);
                    }}
                  />
                </Suspense>
              )}

              {pendingExtensionApproval && (
                <ConversationApprovalShelf
                  confirm={pendingExtensionApproval}
                  remainingMs={extensionApprovalRemainingMs}
                  onCancel={declineApproval}
                  onConfirm={confirmApproval}
                />
              )}

              {pendingAskUserQuestion && composerActiveQuestion && (
                <Suspense fallback={null}>
                  <ConversationQuestionShelf
                    presentation={pendingAskUserQuestion.presentation}
                    activeQuestion={composerActiveQuestion}
                    activeQuestionIndex={composerQuestionIndex}
                    activeOptionIndex={composerQuestionOptionIndex}
                    answers={composerQuestionAnswers}
                    submitting={composerQuestionSubmitting}
                    answeredCount={composerQuestionAnsweredCount}
                    onActivateQuestion={activateComposerQuestion}
                    onSelectOption={handleComposerQuestionOptionSelect}
                  />
                </Suspense>
              )}

              {composerShelvesBottom.map((shelf) => (
                <ComposerShelfHost key={`${shelf.extensionId}:${shelf.id}`} registration={shelf} shelfContext={composerShelfContext} />
              ))}
            </>
          }
          inputControls={
            <ConversationComposerInputControls
              conversationId={id}
              fileInputRef={fileInputRef}
              textareaRef={textareaRef}
              input={input}
              pendingAskUserQuestion={Boolean(pendingAskUserQuestion)}
              composerDisabled={composerDisabled}
              composerShellWidth={composerShellWidth}
              streamIsStreaming={composerRunState.streamControlsActive}
              models={models}
              currentModel={models.length > 0 ? currentModel || model || defaultModel : ''}
              currentThinkingLevel={currentThinkingLevel}
              savingPreference={savingPreference}
              conversationNeedsTakeover={conversationNeedsTakeover}
              composerHasContent={composerHasContent}
              composerShowsQuestionSubmit={composerShowsQuestionSubmit}
              composerQuestionCanSubmit={composerQuestionCanSubmit}
              composerQuestionRemainingCount={composerQuestionRemainingCount}
              composerQuestionSubmitting={composerQuestionSubmitting}
              composerSubmitLabel={composerSubmit.label}
              composerAltHeld={composerAltHeld}
              composerPlaceholder={composerPlaceholder}
              onFilesSelected={(files) => {
                void addComposerFiles(files);
              }}
              onInputChange={(value, textarea) => {
                setInput(value);
                resetComposerMenus();
                rememberComposerSelection(textarea);
              }}
              onRememberComposerSelection={rememberComposerSelection}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onOpenFilePicker={openFilePicker}
              onUpsertDrawingAttachment={(payload) => {
                upsertDrawingAttachment(payload as ExcalidrawEditorSavePayload);
              }}
              onSelectModel={selectModel}
              onSelectThinkingLevel={(thinkingLevel) => {
                void saveThinkingLevelPreference(thinkingLevel);
              }}
              onSelectServiceTier={(serviceTier) => {
                void saveServiceTierPreference(serviceTier);
              }}
              onInsertComposerText={insertTextIntoComposer}
              onAppendComposerText={appendTextToComposer}
              onSubmitComposerQuestion={() => {
                void submitComposerQuestionIfReady();
              }}
              onSubmitComposerActionForModifiers={(altKeyHeld) => {
                void submitComposerActionForModifiers(altKeyHeld);
              }}
              onAbortStream={() => {
                void stopStreamAndRestoreQueuedPrompts();
              }}
            />
          }
          composerMeta={
            showComposerMeta ? (
              <ConversationComposerMeta
                draft={draft}
                hasDraftCwd={hasDraftCwd}
                draftCwdValue={draftCwdValue}
                draftCwdError={draftCwdError}
                draftCwdPickBusy={draftCwdPickBusy}
                availableDraftWorkspacePaths={availableDraftWorkspacePaths}
                onClearDraftCwdSelection={clearDraftConversationCwdSelection}
                onSelectDraftWorkspace={selectDraftConversationWorkspace}
                onPickDraftCwd={() => {
                  void pickDraftConversationCwd();
                }}
                conversationCwdEditorOpen={conversationCwdEditorOpen}
                currentCwd={currentCwd}
                currentCwdLabel={currentCwdLabel}
                conversationCwdDraft={conversationCwdDraft}
                conversationCwdError={conversationCwdError}
                conversationCwdBusy={conversationCwdBusy}
                conversationCwdPickBusy={conversationCwdPickBusy}
                availableConversationWorkspacePaths={availableConversationWorkspacePaths}
                onSubmitConversationCwdChange={(cwd) => {
                  void submitConversationCwdChange(cwd);
                }}
                onCancelConversationCwdEdit={cancelConversationCwdEdit}
                onPickConversationCwd={() => {
                  void pickConversationCwd();
                }}
                onBeginConversationCwdEdit={beginConversationCwdEdit}
                branchLabel={branchLabel}
                gitSummaryPresentation={gitSummaryPresentation}
                sessionTokens={sessionTokens}
              />
            ) : null
          }
        />
      )}

      {selectedArtifactId && id && !artifactOpensInWorkbenchPane && (
        <Suspense fallback={null}>
          <ConversationArtifactModal conversationId={id} artifactId={selectedArtifactId} />
        </Suspense>
      )}

      {drawingsPickerOpen && id && (
        <Suspense fallback={null}>
          <ConversationDrawingsPickerModal
            attachments={conversationAttachments}
            onLoadAttachment={async (attachmentId) => {
              const detail = await api.conversationAttachment(id, attachmentId);
              return detail.attachment;
            }}
            onAttach={(selection) => {
              void attachSavedDrawing(selection);
            }}
            onClose={() => setDrawingsPickerOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
