import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { useAppData, useAppEvents, useLiveTitles } from '../app/contexts';
import { api } from '../client/api';
import {
  completeConversationOpenPhase,
  ensureConversationOpenStart,
  measureClientPerfTiming,
  recordClientPerfTiming,
} from '../client/perfDiagnostics';
import { buildSlashMenuItems } from '../commands/slashMenu';
import { ComposerAttachmentShelf } from '../components/chat/ComposerAttachmentShelf';
import { resolveConversationComposerShellStateClassName } from '../components/conversation/ConversationComposerChrome';
import { ConversationComposerInputControls } from '../components/conversation/ConversationComposerInputControls';
import { MentionMenu, ModelPicker, SlashMenu } from '../components/conversation/ConversationComposerMenus';
import { ConversationComposerMeta } from '../components/conversation/ConversationComposerMeta';
import {
  ConversationDraftEmptyAction,
  DRAFT_EMPTY_STATE_CONTENT_WIDTH_CLASS,
} from '../components/conversation/ConversationDraftEmptyAction';
import { ConversationGoalPanel } from '../components/conversation/ConversationGoalPanel';
import { addNotification } from '../components/notifications/notificationStore';
import { AppPageEmptyState, cx, EmptyState, LoadingState, PageHeader, Pill } from '../components/ui';
import type { ExcalidrawSceneData } from '../content/excalidrawUtils';
import { parseExcalidrawSceneFromSourceData } from '../content/excalidrawUtils';
import {
  buildBrowserCommentContextMessages,
  buildBrowserCommentsStorageKey,
  mergeContextMessages,
  normalizePendingBrowserComments,
  type PendingBrowserComment,
  readBrowserChangedContextMessage,
} from '../conversation/browserContextMessages';
import { appendComposerHistory, readComposerHistory } from '../conversation/composerHistory';
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
} from '../conversation/conversationComposerEditing';
import { resolveConversationComposerMenuState } from '../conversation/conversationComposerMenuState';
import { shouldShowConversationComposerMeta } from '../conversation/conversationComposerMetaVisibility';
import {
  appendMentionedConversationContextDocs,
  dedupeConversationContextDocs,
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
import { formatConversationCwdLabel, hasDraftConversationCwd } from '../conversation/conversationCwdPresentation';
import {
  nextDragOverStateForDragEnd,
  nextDragOverStateForDragOver,
  shouldHandleDroppedComposerFiles,
} from '../conversation/conversationDragDrop';
import {
  buildBackgroundExecutionIndicatorText,
  buildScheduledTaskIndicatorText,
  selectConversationScheduledTasks,
} from '../conversation/conversationExecutionActivity';
import { buildComposerShelfContext, buildNewConversationPanelContext } from '../conversation/conversationExtensionContexts';
import { buildMissionAutoModeInputFromDraft, createDraftMissionTask } from '../conversation/conversationGoalMode';
import { formatThinkingLevelLabel } from '../conversation/conversationHeader';
import {
  buildConversationInitialModelPreferenceState,
  resolveConversationDraftHydrationState,
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
import {
  buildMentionItems,
  filterMentionItems,
  MAX_MENTION_MENU_ITEMS,
  type MentionItem,
  resolveMentionItems,
} from '../conversation/conversationMentions';
import { shouldEnableMessageForkControls } from '../conversation/conversationMessageControls';
import { pruneComputedMessages, resolveComputedMessagesRaw } from '../conversation/conversationMessageWindow';
import { resolveDraftModelPreferenceUpdate, resolveDraftThinkingPreferenceUpdate } from '../conversation/conversationModelPreferences';
import { buildLiveSessionPreferenceInput, selectComposerModel } from '../conversation/conversationModelSelection';
import {
  hasConversationLoadedHistoricalTailBlocks,
  mergeConversationSessionMeta,
  replaceConversationMetaInSessionList,
  replaceConversationTitleInSessionList,
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
import { resolveRelatedThreadResults, selectDraftRelatedThreadCandidates } from '../conversation/conversationRelatedThreadPanel';
import { insertReplyQuoteIntoComposer } from '../conversation/conversationReplyQuote';
import { didConversationStopMidTurn, didConversationStopWithError, getConversationResumeState } from '../conversation/conversationResume';
import {
  filterVisibleActiveConversationBackgroundExecutions,
  shouldLoadConversationRun as resolveShouldLoadConversationRun,
} from '../conversation/conversationRunLoading';
import { createConversationLiveRunId, getConversationRunIdFromSearch } from '../conversation/conversationRuns';
import { shouldRefetchSavedWorkspacePaths, syncSavedWorkspacePathValues } from '../conversation/conversationSavedWorkspaces';
import {
  getConversationInitialScrollKey,
  getConversationTailBlockKey,
  shouldShowScrollToBottomControl,
} from '../conversation/conversationScroll';
import { isConversationSessionNotLiveError, primeCreatedConversationOpenCaches } from '../conversation/conversationSessionLifecycle';
import { findConversationSessionById } from '../conversation/conversationSessionSelection';
import { type ConversationSlashCommand, parseConversationSlashCommand } from '../conversation/conversationSlashCommand';
import { buildSuggestedContextShelfState } from '../conversation/conversationSuggestedContextShelf';
import { NEW_CONVERSATION_TITLE } from '../conversation/conversationTitle';
import { buildOpenArtifactSearch, buildOpenKnowledgeFileSearch } from '../conversation/conversationWorkbenchNavigation';
import { buildAvailableDraftWorkspacePaths, resolveConversationCurrentCwd } from '../conversation/conversationWorkspaceState';
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
  type ExtensionSlashCommandResult,
  findExtensionSlashCommand as findExtensionSlashCommandMatch,
  resolveExtensionSlashCommandResult,
} from '../conversation/extensionSlashCommands';
import {
  buildConversationComposerStorageKey,
  persistForkPromptDraft,
  resolveBranchEntryIdFromSessionDetailResult,
  resolveRewindTargetForMessage,
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
import { rankRelatedConversationSessions, type RelatedConversationSearchResult } from '../conversation/relatedConversationSearch';
import {
  pruneRelatedThreadSelectionIds,
  resolveRelatedThreadPreselectionUpdate,
  selectMissingRelatedThreadSearchIndexIds,
  selectMissingRelatedThreadSummaryIds,
  toggleRelatedThreadSelectionIds,
} from '../conversation/relatedThreadSelection';
import { collectCompletedToolAutoOpenBlockKeys, findRequestedToolPresentationToOpen } from '../conversation/toolAutoOpen';
import { useComposerController } from '../conversation/useComposerController';
import { useConversationActiveExecutions } from '../conversation/useConversationActiveExecutions';
import { useComposerModifierKeys, useVisualViewportKeyboardInset } from '../conversation/useConversationKeyboardState';
import { useConversationModels } from '../conversation/useConversationModels';
import { useDesktopConversationShortcuts } from '../conversation/useDesktopConversationShortcuts';
import { hasBlockingConversationOverlay, useEscapeAbortStream } from '../conversation/useEscapeAbortStream';
import { useInitialDraftAttachmentHydration } from '../conversation/useInitialDraftAttachmentHydration';
import { MAX_RELATED_THREAD_HOTKEYS, useRelatedThreadHotkeys } from '../conversation/useRelatedThreadHotkeys';
import { useWorkspaceComposerEvents } from '../conversation/useWorkspaceComposerEvents';
import { shouldAutoResumeDeferredResumes } from '../deferred-resume/deferredResumeAutoResume';
import { describeDeferredResumeStatus, resolveDeferredResumePresentationState } from '../deferred-resume/deferredResumeIndicator';
import { parseDeferredResumeSlashCommand } from '../deferred-resume/deferredResumeSlashCommand';
import { DESKTOP_SHOW_WORKBENCH_BROWSER_EVENT } from '../desktop/desktopBridge';
import { ComposerShelfHost } from '../extensions/ComposerShelfHost';
import { ConversationHeaderHost } from '../extensions/ConversationHeaderHost';
import { ConversationLifecycleHost } from '../extensions/ConversationLifecycleHost';
import { buildExtensionMentionItems } from '../extensions/extensionMentions';
import { createNativeExtensionClient } from '../extensions/nativePaClient';
import { NewConversationPanelHost } from '../extensions/NewConversationPanelHost';
import type { ExtensionMentionRegistration, ExtensionSlashCommandRegistration } from '../extensions/types';
import { useExtensionRegistry } from '../extensions/useExtensionRegistry';
import { INITIAL_STREAM_STATE, retryLiveSessionActionAfterTakeover } from '../hooks/sessionStream';
import { useConversationBootstrap } from '../hooks/useConversationBootstrap';
import { useConversationEventVersion } from '../hooks/useConversationEventVersion';
import { useConversationScroll } from '../hooks/useConversationScroll';
import { useDesktopConversationState } from '../hooks/useDesktopConversationState';
import { useInvalidateOnTopics } from '../hooks/useInvalidateOnTopics';
import { primeSessionDetailCache, useSessionDetail } from '../hooks/useSessions';
import { useReloadState } from '../local/reloadState';
import { normalizeWorkspacePaths, readStoredWorkspacePaths, writeStoredWorkspacePaths } from '../local/savedWorkspacePaths';
import { filterModelPickerItems } from '../model/modelPicker';
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
  resolveRestoredQueuedPromptComposerUpdate,
} from '../pending/pendingQueueMessages';
import { closeConversationTab, ensureConversationTabOpen, setActiveConversationTab } from '../session/sessionTabs';
import type {
  ConversationAttachmentSummary,
  ConversationContextDocRef,
  DeferredResumeSummary,
  DurableRunRecord,
  LiveSessionContext,
  MemoryData,
  MessageBlock,
  PromptAttachmentRefInput,
} from '../shared/types';
import type { ConversationSummaryRecord } from '../shared/types';
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
  mergeHistoricalAndStreamBlocks,
  mergeHydratedHistoricalBlocks,
  mergeHydratedStreamBlocks,
  normalizeHistoricalBlockId,
  removeHydratingHistoricalBlockId,
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
export { constrainPromptImageDimensions } from '../conversation/promptAttachments';

const ConversationArtifactModal = lazy(() =>
  import('../components/ConversationArtifactModal').then((module) => ({ default: module.ConversationArtifactModal })),
);
const ConversationDrawingsPickerModal = lazy(() =>
  import('../components/ConversationDrawingsPickerModal').then((module) => ({ default: module.ConversationDrawingsPickerModal })),
);
const ChatView = lazy(() => import('../components/chat/ChatView').then((module) => ({ default: module.ChatView })));
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

const INITIAL_HISTORICAL_TAIL_BLOCKS = 24;
const HISTORICAL_TAIL_BLOCKS_STEP = 120;
const HISTORICAL_TAIL_BLOCKS_STEP_PERCENT = 10;
const MAX_RELATED_THREAD_SELECTIONS = 5;
const MAX_VISIBLE_RELATED_THREAD_RESULTS = 10;
const RELATED_THREAD_RECENT_WINDOW_DAYS = 3;
const MAX_RELATED_THREAD_CANDIDATES = 24;

const HISTORICAL_TAIL_BLOCKS_JUMP_PADDING = 40;
const MAX_RENDERED_BLOCKS = 300;
const HISTORICAL_PREFETCH_SCROLL_THRESHOLD_PX = 1400;
const WORKBENCH_BROWSER_COMMENT_ADDED_EVENT = 'pa:workbench-browser-comment-added';
const EMPTY_PENDING_BROWSER_COMMENTS: PendingBrowserComment[] = [];

export { shouldEnableMessageForkControls };

// ── ConversationPage ──────────────────────────────────────────────────────────

export { buildMissionAutoModeInputFromDraft, createDraftMissionTask };

export function ConversationPage({ draft = false }: { draft?: boolean }) {
  const { id: routeId } = useParams<{ id?: string }>();
  const id = draft ? undefined : routeId;
  const location = useLocation();
  const navigate = useNavigate();
  const selectedArtifactId = getConversationArtifactIdFromSearch(location.search);
  const selectedCheckpointId = getConversationCheckpointIdFromSearch(location.search);
  const selectedRunId = getConversationRunIdFromSearch(location.search);
  const previousSelectedRunIdRef = useRef<string | null | undefined>(undefined);
  const [appLayoutMode, setAppLayoutMode] = useState<AppLayoutMode>(() => readAppLayoutMode());
  const artifactOpensInWorkbenchPane = appLayoutMode === 'workbench';
  const { versions } = useAppEvents();
  const { tasks, sessions, runs, setRuns, setSessions, setTasks } = useAppData();
  const [remoteControlledConversationIds, setRemoteControlledConversationIds] = useState<string[]>([]);
  const conversationEventVersion = useConversationEventVersion(id);
  useEffect(() => {
    let cancelled = false;
    void api
      .openConversationTabs()
      .then((layout) => {
        if (!cancelled) setRemoteControlledConversationIds(layout.remoteControlledConversationIds ?? []);
      })
      .catch(() => {
        if (!cancelled) setRemoteControlledConversationIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [versions.sessions]);

  const openArtifact = useCallback(
    (artifactId: string) => {
      if (selectedArtifactId === artifactId) {
        return;
      }

      const nextSearch = buildOpenArtifactSearch(location.search, artifactId);

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

  useEffect(() => {
    if (draft || !id) {
      return;
    }

    ensureConversationTabOpen(id);
    setActiveConversationTab(id);
  }, [draft, id]);

  // ── Live session detection ─────────────────────────────────────────────────
  const rawSessionSnapshot = useMemo(() => findConversationSessionById(sessions, id), [id, sessions]);
  const sessionSnapshot = rawSessionSnapshot;

  const sessionsLoaded = sessions !== null;
  // We use a confirmed-live flag only for lightweight session-state labeling.
  const [confirmedLive, setConfirmedLive] = useState<boolean | null>(null);
  const [liveSessionHasStaleTurnState, setLiveSessionHasStaleTurnState] = useState(false);
  const [pendingInitialPrompt, setPendingInitialPrompt] = useState<PendingConversationPrompt | null>(() =>
    resolveConversationInitialPendingPromptState({ draft, conversationId: id, locationState: location.state }),
  );
  const [pendingInitialPromptDispatching, setPendingInitialPromptDispatchingState] = useState(false);
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
  const desktopConversation = useDesktopConversationState(id ?? null, {
    tailBlocks: historicalTailBlocks,
    enabled: shouldSubscribeToDesktopConversationState({ draft }),
  });
  const desktopConversationChecking = !draft && Boolean(id) && desktopConversation.mode === 'checking';
  const useDesktopConversation = shouldUseHealthyDesktopConversationState({
    draft,
    conversationId: id,
    desktopMode: desktopConversation.mode,
    desktopError: desktopConversation.error,
  });
  const visibleDesktopConversationState =
    useDesktopConversation && id && desktopConversation.state?.conversationId === id ? desktopConversation.state : null;
  const conversationVersionKey = `${effectiveConversationEventVersion}`;
  const { data: webConversationBootstrap, loading: webConversationBootstrapLoading } = useConversationBootstrap(
    draft || useDesktopConversation || desktopConversationChecking ? undefined : id,
    {
      tailBlocks: historicalTailBlocks,
      versionKey: conversationVersionKey,
    },
  );
  const visibleConversationBootstrap = useDesktopConversation
    ? id && visibleDesktopConversationState
      ? {
          conversationId: id,
          sessionDetail: visibleDesktopConversationState.sessionDetail,
          liveSession: visibleDesktopConversationState.liveSession,
        }
      : null
    : id && webConversationBootstrap?.conversationId === id
      ? webConversationBootstrap
      : null;
  const bootstrapSessionDetail = useDesktopConversation
    ? (visibleDesktopConversationState?.sessionDetail ?? null)
    : id && visibleConversationBootstrap?.sessionDetail?.meta.id === id
      ? visibleConversationBootstrap.sessionDetail
      : null;
  const conversationBootstrapLoading = useDesktopConversation
    ? desktopConversation.loading
    : desktopConversationChecking
      ? true
      : webConversationBootstrapLoading;
  const confirmedLiveValue = useDesktopConversation ? (visibleConversationBootstrap?.liveSession.live ?? null) : null;

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
  const currentSurfaceId = stream.surfaceId;

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
      setConfirmedLive(visibleConversationBootstrap?.liveSession.live ?? false);
      setLiveSessionHasStaleTurnState(
        visibleConversationBootstrap?.liveSession.live === true && visibleConversationBootstrap.liveSession.hasStaleTurnState === true,
      );
      return;
    }

    if (!id) {
      setConfirmedLive(false);
      setLiveSessionHasStaleTurnState(false);
      return;
    }

    if (visibleConversationBootstrap?.liveSession.live) {
      setConfirmedLive(true);
      setLiveSessionHasStaleTurnState(visibleConversationBootstrap.liveSession.hasStaleTurnState === true);
      return;
    }

    if (visibleConversationBootstrap?.liveSession.live === false || sessionSnapshot?.isLive === false) {
      setConfirmedLive(false);
      setLiveSessionHasStaleTurnState(false);
      return;
    }

    setConfirmedLive(sessionSnapshot?.isLive === true ? true : null);
    let cancelled = false;

    api
      .liveSession(id)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setConfirmedLive(response.live);
        setLiveSessionHasStaleTurnState(response.live && response.hasStaleTurnState === true);
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
    visibleConversationBootstrap?.liveSession.live ??
    sessionSnapshot?.isLive ??
    (useDesktopConversation ? confirmedLiveValue : confirmedLive);
  const conversationNeedsTakeover = false;
  const rawComposerRunState = resolveConversationComposerRunState({
    streamIsStreaming: stream.isStreaming,
    sessionIsRunning: sessionSnapshot?.isRunning,
    bootstrapLiveSessionIsStreaming:
      visibleConversationBootstrap?.liveSession.live === true ? visibleConversationBootstrap.liveSession.isStreaming : false,
    desktopLiveSessionIsStreaming:
      visibleDesktopConversationState?.liveSession.live === true ? visibleDesktopConversationState.liveSession.isStreaming : false,
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
  }, [draft, id]);

  // ── Existing session data (read-only JSONL) ───────────────────────────────
  useEffect(() => {
    if (useDesktopConversation || !id || !bootstrapSessionDetail) {
      return;
    }

    primeSessionDetailCache(id, bootstrapSessionDetail, { tailBlocks: historicalTailBlocks }, effectiveConversationEventVersion);
  }, [bootstrapSessionDetail, effectiveConversationEventVersion, historicalTailBlocks, id, useDesktopConversation]);

  const bootstrapPendingInitialSessionDetail =
    !useDesktopConversation && Boolean(id) && conversationBootstrapLoading && !bootstrapSessionDetail;
  const {
    detail: webSessionDetail,
    loading: webSessionLoading,
    error: webSessionError,
  } = useSessionDetail(bootstrapPendingInitialSessionDetail || useDesktopConversation || desktopConversationChecking ? undefined : id, {
    tailBlocks: historicalTailBlocks,
    version: effectiveConversationEventVersion,
  });
  const sessionDetail = useDesktopConversation ? (visibleDesktopConversationState?.sessionDetail ?? null) : webSessionDetail;
  const sessionLoading = useDesktopConversation ? desktopConversation.loading : desktopConversationChecking ? true : webSessionLoading;
  const sessionError = useDesktopConversation ? desktopConversation.error : desktopConversationChecking ? null : webSessionError;
  const visibleSessionDetail = useDesktopConversation
    ? sessionDetail
    : sessionDetail?.meta.id === id
      ? sessionDetail
      : bootstrapSessionDetail;
  const [hydratedHistoricalBlocks, setHydratedHistoricalBlocks] = useState<Record<string, MessageBlock>>({});
  const [hydratingHistoricalBlockIds, setHydratingHistoricalBlockIds] = useState<string[]>([]);
  const hydratingHistoricalBlockIdSet = useMemo(
    () => buildHydratingHistoricalBlockIdSet(hydratingHistoricalBlockIds),
    [hydratingHistoricalBlockIds],
  );

  useEffect(() => {
    setHydratedHistoricalBlocks({});
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
        const block = await api.sessionBlock(id, normalizedBlockId);
        const messageBlock = displayBlockToMessageBlock(block);
        setHydratedHistoricalBlocks((current) => ({
          ...current,
          [normalizedBlockId]: messageBlock,
        }));
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
            hydratedBlockCount: Object.keys(hydratedHistoricalBlocks).length,
          },
        },
        () => (visibleSessionDetail ? mergeHydratedHistoricalBlocks(visibleSessionDetail.blocks, hydratedHistoricalBlocks) : []),
      ),
    [hydratedHistoricalBlocks, id, visibleSessionDetail],
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
            hydratedBlockCount: Object.keys(hydratedHistoricalBlocks).length,
          },
        },
        () => mergeHydratedStreamBlocks(stream.blocks, hydratedHistoricalBlocks),
      ),
    [hydratedHistoricalBlocks, id, stream.blocks],
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
    sessionTitle: id ? sessions?.find((session) => session.id === id)?.title : undefined,
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
    const { normalizedTitle, shouldPushLiveTitle, nextSessions } = resolveConversationStreamTitleSync({
      draft,
      conversationId: id,
      streamTitle: stream.title,
      liveTitle: id ? titles.get(id) : undefined,
      sessions,
    });

    if (!normalizedTitle) {
      return;
    }

    if (shouldPushLiveTitle && id) {
      pushTitle(id, normalizedTitle);
    }

    if (nextSessions && nextSessions !== sessions) {
      setSessions(nextSessions);
    }
  }, [draft, id, pushTitle, sessions, setSessions, stream.title, titles]);

  const [nonCriticalComposerMetadataReady, setNonCriticalComposerMetadataReady] = useState(false);
  useEffect(() => {
    setNonCriticalComposerMetadataReady(false);
    const timeout = window.setTimeout(() => setNonCriticalComposerMetadataReady(true), 1_500);
    return () => window.clearTimeout(timeout);
  }, [draft, id]);

  const shouldLoadModels = shouldLoadConversationModelsAfterMetadataReady({
    metadataReady: nonCriticalComposerMetadataReady,
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
      return;
    }

    void api.prewarmLiveSession(draftCwdValue || undefined).catch(() => {
      // Best-effort latency prewarm only; send still creates the session normally.
    });
  }, [draft, draftCwdValue]);

  useEffect(() => {
    if (!draft) {
      setDraftCwdValue('');
      return;
    }

    const syncDraftPreferences = () => {
      setCurrentModel(
        resolveSelectableModelId({
          requestedModel: readDraftConversationModel(),
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
    if (!draft) {
      setDraftCwdPickBusy(false);
      setDraftCwdError(null);
    }
  }, [draft]);

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

  const goalEnabled = stream.goalState?.status === 'active';
  const [extensionSlashCommands, setExtensionSlashCommands] = useState<ExtensionSlashCommandRegistration[]>([]);
  const [extensionMentionRegistrations, setExtensionMentionRegistrations] = useState<ExtensionMentionRegistration[]>([]);
  const [extensionMentionItems, setExtensionMentionItems] = useState<MentionItem[]>([]);

  useEffect(() => {
    if (!nonCriticalComposerMetadataReady) {
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
  }, [nonCriticalComposerMetadataReady]);

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
  const [draftWorkspaceGit, setDraftWorkspaceGit] = useState<{
    branch: string | null;
    changeCount: number;
    linesAdded: number;
    linesDeleted: number;
  } | null>(null);

  const [notice, setNotice] = useState<{ tone: 'accent' | 'danger'; text: string } | null>(null);
  const [savingPreference, setSavingPreference] = useState<'model' | 'thinking' | 'serviceTier' | null>(null);
  const [modelIdx, setModelIdx] = useState(0);
  const noticeTimeoutRef = useRef<number | null>(null);
  const showNotice = useCallback((tone: 'accent' | 'danger', text: string, durationMs = 2500) => {
    setNotice({ tone, text });
    if (tone === 'danger') {
      addNotification({ type: 'warning', message: text, source: 'core' });
    }
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimeoutRef.current = null;
    }, durationMs);
  }, []);

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
  const [debouncedRelatedThreadsQuery, setDebouncedRelatedThreadsQuery] = useState(() => input.trim());
  const [relatedThreadSearchIndex, setRelatedThreadSearchIndex] = useState<Record<string, string>>({});
  const [relatedThreadSummaries, setRelatedThreadSummaries] = useState<Record<string, ConversationSummaryRecord>>({});
  const [relatedThreadSearchLoading, setRelatedThreadSearchLoading] = useState(false);
  const [relatedThreadSearchError, setRelatedThreadSearchError] = useState<string | null>(null);
  const [selectedRelatedThreadIds, setSelectedRelatedThreadIds] = useState<string[]>([]);
  const [autoSelectedRelatedThreadIds, setAutoSelectedRelatedThreadIds] = useState<string[]>([]);
  const [preparingRelatedThreadContext, setPreparingRelatedThreadContext] = useState(false);
  const [slashIdx, setSlashIdx] = useState(0);
  const [mentionIdx, setMentionIdx] = useState(0);
  const keyboardInset = useVisualViewportKeyboardInset();
  const [attachments, setAttachments] = useState<ComposerImageAttachment[]>([]);
  const showTextOnlyImageHint =
    attachments.length > 0 && selectedComposerModel !== null && !selectedComposerModel.input?.includes('image') && !defaultVisionModel;
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
    setSlashIdx(0);
    setMentionIdx(0);
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

    setPendingInitialPrompt(
      resolveConversationInitialPendingPromptState({ draft, conversationId: id, locationState: location.state }) ??
        readPendingConversationPrompt(id),
    );
    setPendingInitialPromptDispatchingState(isPendingConversationPromptDispatching(id));
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
      })
    ) {
      return;
    }

    clearPendingConversationPrompt(id);
    setPendingConversationPromptDispatching(id, false);
    setPendingInitialPrompt(null);
    setPendingInitialPromptDispatchingState(false);
  }, [draft, id, pendingInitialPrompt, pendingInitialPromptDispatching, realMessages]);

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
  const [showBackgroundRunDetails, setShowBackgroundRunDetails] = useState(false);
  const { executions: activeConversationBackgroundExecutions, refresh: refreshActiveConversationBackgroundExecutions } =
    useConversationActiveExecutions(draft ? null : id);
  const composerDisabled = isConversationComposerDisabled({
    conversationNeedsTakeover,
    preparingRelatedThreadContext,
    wholeLineBashRunning,
  });

  useEffect(() => {
    setPendingAssistantStatusLabel(null);
    setShowBackgroundRunDetails(false);
  }, [id]);

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
    if (draft || runs !== null) {
      return;
    }

    let cancelled = false;
    void api
      .runs()
      .then((result) => {
        if (!cancelled) {
          setRuns(result);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [draft, runs, setRuns]);

  const cancelBackgroundRunFromShelf = useCallback(
    (runId: string) => {
      const normalizedRunId = runId.trim();
      if (!normalizedRunId) {
        return;
      }

      setCancellingBackgroundRunIds((current) => new Set(current).add(normalizedRunId));
      void api
        .cancelExecution(normalizedRunId)
        .then(() => refreshActiveConversationBackgroundExecutions())
        .catch(() => {})
        .finally(() => {
          setCancellingBackgroundRunIds((current) => {
            const next = new Set(current);
            next.delete(normalizedRunId);
            return next;
          });
        });
    },
    [refreshActiveConversationBackgroundExecutions],
  );

  useEffect(() => {
    if (autocompleteCatalogDemand.needsMemoryData) {
      setShouldLoadMemoryData(true);
    }
  }, [autocompleteCatalogDemand.needsMemoryData]);

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
  const composerSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const composerResizeFrameRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingJumpMessageIndexRef = useRef<number | null>(null);
  const [requestedFocusMessageIndex, setRequestedFocusMessageIndex] = useState<number | null>(null);

  const resetComposerMenus = useCallback(() => {
    setSlashIdx(0);
    setMentionIdx(0);
  }, []);

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

    const updateWidth = () => {
      const nextWidth = Math.max(0, Math.floor(element.getBoundingClientRect().width));
      setComposerShellWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
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
        capturePrependRestore();
      }

      const tailBlockStep = Math.max(1, Math.ceil(options?.tailBlockStep ?? HISTORICAL_TAIL_BLOCKS_STEP));

      setHistoricalTailBlocks((currentTailBlocks) => {
        const minimumTailBlocks =
          typeof targetMessageIndex === 'number'
            ? Math.max(currentTailBlocks + tailBlockStep, historicalTotalBlocks - targetMessageIndex + HISTORICAL_TAIL_BLOCKS_JUMP_PADDING)
            : currentTailBlocks + tailBlockStep;
        const nextTailBlocks = Math.min(historicalTotalBlocks, minimumTailBlocks);

        return nextTailBlocks > currentTailBlocks ? nextTailBlocks : currentTailBlocks;
      });
    },
    [capturePrependRestore, historicalTotalBlocks, id, sessionLoading],
  );

  // Derive menu states
  const { showModelPicker, showSlash, showMention, slashQuery, modelQuery, mentionQuery } = useMemo(
    () => resolveConversationComposerMenuState(input),
    [input],
  );
  const slashItems = useMemo(
    () => buildSlashMenuItems(input, memoryData?.skills ?? [], extensionSlashCommands),
    [extensionSlashCommands, input, memoryData],
  );
  const modelItems = useMemo(() => filterModelPickerItems(models, modelQuery), [models, modelQuery]);

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
        extensionItems: extensionMentionItems,
      }),
    [tasks, extensionMentionItems],
  );
  const currentSessionMeta = useMemo(
    () => mergeConversationSessionMeta(visibleSessionDetail?.meta, sessionSnapshot),
    [sessionSnapshot, visibleSessionDetail?.meta],
  );

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
  const currentCwdLabel = useMemo(() => formatConversationCwdLabel(currentCwd), [currentCwd]);
  const hasDraftCwd = hasDraftConversationCwd(draftCwdValue);
  const availableDraftWorkspacePaths = useMemo(
    () => buildAvailableDraftWorkspacePaths({ draftCwdValue, savedWorkspacePaths }),
    [draftCwdValue, savedWorkspacePaths],
  );
  const relatedThreadCandidates = useMemo(
    () =>
      selectDraftRelatedThreadCandidates({
        draft,
        sessions,
        workspaceCwd: draftCwdValue || null,
        recentWindowDays: RELATED_THREAD_RECENT_WINDOW_DAYS,
        limit: MAX_RELATED_THREAD_CANDIDATES,
      }),
    [draft, draftCwdValue, sessions],
  );
  const relatedThreadCandidateIds = useMemo(() => relatedThreadCandidates.map((candidate) => candidate.id), [relatedThreadCandidates]);
  const relatedThreadCandidateById = useMemo(
    () => new Map(relatedThreadCandidates.map((candidate) => [candidate.id, candidate] as const)),
    [relatedThreadCandidates],
  );
  const visibleRelatedThreadResults = useMemo<RelatedConversationSearchResult[]>(
    () =>
      resolveRelatedThreadResults({
        selectedRelatedThreadIds,
        query: debouncedRelatedThreadsQuery,
        candidates: relatedThreadCandidates,
        searchIndex: relatedThreadSearchIndex,
        summaries: relatedThreadSummaries,
        workspaceCwd: draftCwdValue || null,
        limit: MAX_VISIBLE_RELATED_THREAD_RESULTS,
      }),
    [
      debouncedRelatedThreadsQuery,
      draftCwdValue,
      relatedThreadCandidates,
      relatedThreadSearchIndex,
      relatedThreadSummaries,
      selectedRelatedThreadIds,
    ],
  );
  const relatedThreadSearchResults = useMemo(
    () =>
      rankRelatedConversationSessions({
        sessions: relatedThreadCandidates,
        searchIndex: relatedThreadSearchIndex,
        summaries: relatedThreadSummaries,
        query: debouncedRelatedThreadsQuery,
        workspaceCwd: draftCwdValue || null,
        limit: MAX_VISIBLE_RELATED_THREAD_RESULTS,
      }),
    [debouncedRelatedThreadsQuery, draftCwdValue, relatedThreadCandidates, relatedThreadSearchIndex, relatedThreadSummaries],
  );
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
  const branchLabel = draft ? (draftWorkspaceGit?.branch ?? null) : (liveSessionContext?.branch ?? null);
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
        composerButtonCount: extensionRegistry.composerButtons.length,
        composerShelfCount: extensionRegistry.composerShelves.length,
        conversationHeaderElementCount: extensionRegistry.conversationHeaderElements.length,
        error: extensionRegistry.error,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    draft,
    extensionRegistry.composerButtons.length,
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

  useRelatedThreadHotkeys({
    enabled: draft && !preparingRelatedThreadContext,
    results: visibleRelatedThreadResults,
    onToggle: toggleRelatedThreadSelection,
  });

  useEffect(() => {
    const missingSessionIds = selectMissingRelatedThreadSearchIndexIds({
      draft,
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
  }, [debouncedRelatedThreadsQuery, draft, relatedThreadCandidateIds, relatedThreadSearchIndex, selectedRelatedThreadIds.length]);

  useEffect(() => {
    const missingSessionIds = selectMissingRelatedThreadSummaryIds({
      draft,
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
  }, [draft, relatedThreadCandidateIds, relatedThreadSummaries]);

  useEffect(() => {
    const update = resolveRelatedThreadPreselectionUpdate({
      draft,
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
  }, [autoSelectedRelatedThreadIds, debouncedRelatedThreadsQuery, draft, relatedThreadSearchResults, selectedRelatedThreadIds]);

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
    if (!draft || !draftCwdValue) {
      setDraftWorkspaceGit(null);
      return;
    }

    let cancelled = false;
    api
      .workspaceUncommittedDiff(draftCwdValue)
      .then((result) => {
        if (!cancelled) {
          setDraftWorkspaceGit({
            branch: result.branch,
            changeCount: result.changeCount,
            linesAdded: result.linesAdded,
            linesDeleted: result.linesDeleted,
          });
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
    () => resolveConversationGitSummaryPresentation(draft ? draftWorkspaceGit : (liveSessionContext?.git ?? null)),
    [draft, draftWorkspaceGit, liveSessionContext?.git],
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

  useEffect(() => {
    const nextSessions = replaceConversationMetaInSessionList(sessions, id, currentSessionMeta);
    if (nextSessions && nextSessions !== sessions) {
      setSessions(nextSessions);
    }
  }, [currentSessionMeta, id, sessions, setSessions]);

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
  const deferredResumePresentation = useMemo(
    () =>
      resolveDeferredResumePresentationState({
        resumes: deferredResumes,
        nowMs: deferredResumeNowMs,
        isLiveSession,
        sessionFile: savedConversationSessionFile,
      }),
    [deferredResumeNowMs, deferredResumes, isLiveSession, savedConversationSessionFile],
  );
  const orderedDeferredResumes = deferredResumePresentation.orderedResumes;
  const visibleActiveConversationBackgroundExecutions = useMemo(
    () => filterVisibleActiveConversationBackgroundExecutions(activeConversationBackgroundExecutions, conversationRunId),
    [activeConversationBackgroundExecutions, conversationRunId],
  );
  const backgroundExecutionIndicatorText = buildBackgroundExecutionIndicatorText(visibleActiveConversationBackgroundExecutions);
  const showActiveBackgroundRunDetails = showBackgroundRunDetails;
  const conversationScheduledTasks = useMemo(() => selectConversationScheduledTasks({ conversationId: id, tasks }), [id, tasks]);
  const scheduledTaskIndicatorText = buildScheduledTaskIndicatorText(conversationScheduledTasks);
  const runScheduledTaskFromShelf = useCallback(
    async (taskId: string) => {
      await api.runTaskNow(taskId);
      const nextTasks = await api.tasks();
      setTasks(nextTasks);
    },
    [setTasks],
  );

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
  const shouldLoadConversationRun = resolveShouldLoadConversationRun({
    conversationRunId,
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

    const data = await api.conversationAttachments(id);
    setConversationAttachments(data.attachments);
    return data.attachments;
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

    const data = await api.deferredResumes(id);
    setDeferredResumes(data.resumes);
    return data.resumes;
  }, [id]);

  const refetchLiveSessionContext = useCallback(async () => {
    if (draft || !id) {
      setLiveSessionContext(null);
      return null;
    }

    try {
      const next = await api.liveSessionContext(id);
      setLiveSessionContext(next);
      return next;
    } catch {
      setLiveSessionContext(null);
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

  const refetchSavedWorkspacePaths = useCallback(async () => {
    if (!shouldRefetchSavedWorkspacePaths(draft)) {
      return [] as string[];
    }

    setSavedWorkspacePathsLoading(true);
    try {
      const workspacePaths = normalizeWorkspacePaths(await api.savedWorkspacePaths());
      syncSavedWorkspacePaths(workspacePaths);
      return workspacePaths;
    } catch {
      return [] as string[];
    } finally {
      setSavedWorkspacePathsLoading(false);
    }
  }, [draft, syncSavedWorkspacePaths]);

  useEffect(() => {
    if (!draft) {
      return;
    }

    void refetchSavedWorkspacePaths();
  }, [draft, refetchSavedWorkspacePaths]);

  useInvalidateOnTopics(['attachments'], refetchConversationAttachments);
  useInvalidateOnTopics(['sessions'], refetchDeferredResumes);
  useInvalidateOnTopics(['workspace'], refetchLiveSessionContextIfReady);
  useInvalidateOnTopics(['workspace'], refetchSavedWorkspacePaths);

  const resumeDeferredConversation = useCallback(async () => {
    if (!id || !savedConversationSessionFile) {
      throw new Error('Open the saved conversation before continuing deferred work.');
    }

    const recovered = await api.recoverConversation(id);
    if (recovered.conversationId && recovered.conversationId !== id) {
      ensureConversationTabOpen(recovered.conversationId);
      navigate(`/conversations/${recovered.conversationId}`);
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
    if (conversationLiveDecision !== true) {
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
    if (deferredResumes.length === 0) {
      setShowDeferredResumeDetails(false);
      return;
    }

    const intervalHandle = window.setInterval(() => {
      setDeferredResumeNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [deferredResumes.length]);

  useEffect(() => {
    if (
      !shouldAutoResumeDeferredResumes({
        autoResumeKey: deferredResumeAutoResumeKey,
        lastAttemptedKey: attemptedDeferredResumeAutoResumeKeyRef.current,
        draft,
        isLiveSession,
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
    onTextInserted: resetComposerMenus,
  });
  const {
    rememberSelection: rememberComposerSelection,
    moveCaretToEnd: moveComposerCaretToEnd,
    insertText: insertTextIntoComposer,
    appendText: appendTextToComposer,
  } = composerController;

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
    setSlashIdx(0);
  }, [slashQuery]);
  useEffect(() => {
    setModelIdx(0);
  }, [modelQuery]);

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

    if (historicalHasOlderBlocks && !sessionLoading && el.scrollTop <= HISTORICAL_PREFETCH_SCROLL_THRESHOLD_PX) {
      loadOlderMessages();
    }
  }, [historicalHasOlderBlocks, loadOlderMessages, sessionLoading, syncScrollStateFromDom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEscapeAbortStream({
    isStreaming: stream.isStreaming,
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
    if (draft || !id || titleSaving) {
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
  }, [conversationNeedsTakeover, draft, id, title, titleSaving, showNotice]);

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

    await renameConversationTo(nextTitle);
  }, [draft, id, renameConversationTo, showNotice, titleDraft]);

  const submitConversationCwdChange = useCallback(
    async (nextCwdOverride?: string) => {
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

      const nextCwd = (nextCwdOverride ?? conversationCwdDraft).trim();
      if (!nextCwd) {
        setConversationCwdError('Enter a directory path.');
        return;
      }

      setConversationCwdBusy(true);
      setConversationCwdError(null);

      try {
        const result = await api.changeConversationCwd(id, nextCwd, currentSurfaceId);
        setConversationCwdEditorOpen(false);
        setConversationCwdDraft(result.cwd);

        if (!result.changed || result.id === id) {
          stream.reconnect();
          void refetchLiveSessionContext();
          return;
        }

        ensureConversationTabOpen(result.id);
        closeConversationTab(id);
        navigate(`/conversations/${result.id}`);
      } catch (error) {
        setConversationCwdError(error instanceof Error ? error.message : 'Could not change the working directory.');
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
        cwd: conversationCwdDraft.trim() || currentCwd || undefined,
        prompt: 'Choose a working directory',
      });
      if (result.cancelled || !result.path) {
        return;
      }

      setConversationCwdDraft(result.path);
      setConversationCwdEditorOpen(true);
    } catch (error) {
      setConversationCwdError(error instanceof Error ? error.message : 'Could not choose a folder.');
    } finally {
      setConversationCwdPickBusy(false);
    }
  }, [conversationCwdBusy, conversationCwdDraft, conversationCwdPickBusy, currentCwd, draft, ensureConversationCanControl, id]);

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

    setConversationCwdDraft(currentCwd ?? '');
    setConversationCwdError(null);
    setConversationCwdEditorOpen(true);
  }, [conversationCwdBusy, currentCwd, draft, ensureConversationCanControl, id, showNotice, stream.isStreaming]);

  const cancelConversationCwdEdit = useCallback(() => {
    setConversationCwdDraft(currentCwd ?? '');
    setConversationCwdError(null);
    setConversationCwdEditorOpen(false);
  }, [currentCwd]);

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
    async (actionDescription = 'continue') => {
      if (!id) {
        throw new Error('Conversation unavailable.');
      }

      if (isLiveSession) {
        return id;
      }

      const recovered = await api.recoverConversation(id);
      if (!recovered.live) {
        throw new Error(`This conversation could not ${actionDescription}.`);
      }

      if (recovered.conversationId === id) {
        setConfirmedLive(true);
        streamReconnect();
      }

      return recovered.conversationId;
    },
    [id, isLiveSession, streamReconnect, streamTakeover],
  );

  const rewindConversationFromMessage = useCallback(
    async (messageIndex: number) => {
      if (!id || !realMessages) {
        return;
      }

      const localMessageIndex = messageIndex - messageIndexOffset;
      if (localMessageIndex < 0 || localMessageIndex >= realMessages.length) {
        showNotice('danger', 'Load the relevant part of the conversation before rewinding from it.');
        return;
      }

      try {
        const liveConversationId = await ensureConversationIsLive('be rewound');
        const clickedBlock = realMessages[localMessageIndex];
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
            target =
              clickedBlock.type === 'user'
                ? { entryId, beforeEntry: false, promptDraft: null }
                : { entryId, beforeEntry: false, promptDraft: null };
          }
        }

        if (!target) {
          const entries = await api.forkEntries(liveConversationId);
          target = resolveRewindTargetForMessage(realMessages, localMessageIndex, entries);
        }
        if (!target) {
          throw new Error('No forkable message found for that point in the conversation.');
        }

        if (!ensureConversationCanControl('rewind from this message')) {
          return;
        }

        const { newSessionId } = await api.forkSession(
          liveConversationId,
          target.entryId,
          {
            preserveSource: true,
            beforeEntry: target.beforeEntry,
          },
          currentSurfaceId,
        );
        if (target.promptDraft) {
          persistForkPromptDraft(newSessionId, target.promptDraft);
        }
        ensureConversationTabOpen(newSessionId);
        navigate(`/conversations/${newSessionId}`);
      } catch (error) {
        showNotice('danger', `Rewind failed: ${(error as Error).message}`);
      }
    },
    [currentSurfaceId, ensureConversationCanControl, ensureConversationIsLive, id, messageIndexOffset, navigate, realMessages, showNotice],
  );

  const editConversationFromUserMessage = useCallback(
    async (messageIndex: number, text: string) => {
      if (!id || !realMessages) {
        return;
      }

      const editedText = text.trim();
      if (!editedText) {
        showNotice('danger', 'Edited prompt cannot be empty.');
        return;
      }

      const localMessageIndex = messageIndex - messageIndexOffset;
      if (localMessageIndex < 0 || localMessageIndex >= realMessages.length) {
        showNotice('danger', 'Load the relevant part of the conversation before editing it.');
        return;
      }

      const clickedBlock = realMessages[localMessageIndex];
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
        const { newSessionId } = await api.forkSession(
          liveConversationId,
          entryId,
          {
            preserveSource: false,
            beforeEntry: true,
          },
          currentSurfaceId,
        );
        ensureConversationTabOpen(newSessionId);
        navigate(`/conversations/${newSessionId}`, { replace: true });
        await api.promptSession(newSessionId, editedText, undefined, undefined, undefined, currentSurfaceId);
        showNotice('accent', 'Conversation rerunning from edited prompt.');
      } catch (error) {
        showNotice('danger', `Edit failed: ${(error as Error).message}`);
      } finally {
        setPendingAssistantStatusLabel(null);
      }
    },
    [currentSurfaceId, ensureConversationCanControl, ensureConversationIsLive, id, messageIndexOffset, navigate, realMessages, showNotice],
  );

  const forkConversationFromMessage = useCallback(
    async (messageIndex: number) => {
      if (!id || !realMessages) {
        return;
      }

      const localMessageIndex = messageIndex - messageIndexOffset;
      if (localMessageIndex < 0 || localMessageIndex >= realMessages.length) {
        showNotice('danger', 'Load the relevant part of the conversation before branching from it.');
        return;
      }

      const clickedBlock = realMessages[localMessageIndex];
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

        const { newSessionId } = await api.branchSession(liveConversationId, entryId, currentSurfaceId);
        ensureConversationTabOpen(newSessionId);
        navigate(`/conversations/${newSessionId}`);
      } catch (error) {
        showNotice('danger', `Fork failed: ${(error as Error).message}`);
      }
    },
    [currentSurfaceId, ensureConversationCanControl, ensureConversationIsLive, id, messageIndexOffset, navigate, realMessages, showNotice],
  );

  async function saveModelPreference(modelId: string) {
    if (shouldSkipModelPreferenceSave({ modelId, currentModel, savingPreference })) {
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
      if (localId) {
        return current.map((attachment) =>
          attachment.localId === localId
            ? {
                ...attachment,
                title: payload.title,
                sourceData: payload.sourceData,
                sourceMimeType: payload.sourceMimeType,
                sourceName: payload.sourceName,
                previewData: payload.previewData,
                previewMimeType: payload.previewMimeType,
                previewName: payload.previewName,
                previewUrl: payload.previewUrl,
                scene: payload.scene,
                dirty: true,
              }
            : attachment,
        );
      }

      return [
        ...current,
        {
          localId: createComposerDrawingLocalId(),
          title: payload.title,
          sourceData: payload.sourceData,
          sourceMimeType: payload.sourceMimeType,
          sourceName: payload.sourceName,
          previewData: payload.previewData,
          previewMimeType: payload.previewMimeType,
          previewName: payload.previewName,
          previewUrl: payload.previewUrl,
          scene: payload.scene,
          dirty: true,
        } satisfies ComposerDrawingAttachment,
      ];
    });
  }

  async function editDrawing(localId: string) {
    const drawing = drawingAttachments.find((attachment) => attachment.localId === localId);
    if (!drawing) return;

    const excalidrawExtension = extensionRegistry.extensions.find((e) => e.backendActions?.some((a) => a.id === 'image'));
    const excalidrawInputClient = createNativeExtensionClient(excalidrawExtension?.id ?? 'system-excalidraw-input');
    const result = await excalidrawInputClient.ui.openModal({
      component: 'ExcalidrawEditorModal',
      props: { initialTitle: drawing.title, initialScene: drawing.scene, saveLabel: 'Update drawing' },
      size: 'fullscreen',
    });

    if (result && typeof result === 'object') {
      upsertDrawingAttachment(result as ExcalidrawEditorSavePayload, localId);
      showNotice('accent', 'Drawing saved to composer.');
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
      composerController.clear();
      showNotice(
        'accent',
        `Wakeup scheduled${behavior === 'followUp' ? ' as follow-up' : ''} for ${describeDeferredResumeStatus(result.resume)}.`,
      );
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
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
      showNotice('accent', 'Wakeup firing…');
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
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
      showNotice('accent', 'Wakeup cancelled.');
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    } finally {
      setDeferredResumesBusy(false);
    }
  }

  async function continueDeferredResumesNow() {
    if (!id) {
      return;
    }

    if (isLiveSession) {
      await refetchDeferredResumes().catch(() => {});
      return;
    }

    try {
      await resumeDeferredConversation();
      showNotice('accent', 'Resuming deferred work…');
    } catch (error) {
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    }
  }

  const resumeConversation = useCallback(async () => {
    if (!id || draft || resumeConversationBusy) {
      return;
    }

    setResumeConversationBusy(true);
    try {
      const result = await api.recoverConversation(id);
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
      if (isLiveSession) {
        pushTitle(id, result.title);
      }
      const nextSessions = replaceConversationTitleInSessionList(sessions, id, result.title);
      if (nextSessions && nextSessions !== sessions) {
        setSessions(nextSessions);
      }
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

      const nextWorkspacePaths = syncSavedWorkspacePaths([...savedWorkspacePaths, result.path]);
      void api.setSavedWorkspacePaths(nextWorkspacePaths).catch(() => {
        // Ignore best-effort sync failures.
      });
      setDraftConversationCwd(result.path);
    } catch (error) {
      setDraftCwdError(error instanceof Error ? error.message : 'Could not choose a folder.');
    } finally {
      setDraftCwdPickBusy(false);
    }
  }, [draft, draftCwdPickBusy, draftCwdValue, savedWorkspacePaths, setDraftConversationCwd, syncSavedWorkspacePaths]);

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
    beginConversationCwdEdit,
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

  async function executeConversationSlashCommand(
    command: ConversationSlashCommand,
  ): Promise<{ kind: 'handled' } | { kind: 'send'; text: string }> {
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
          showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
        }
        return { kind: 'handled' };
      }
    }
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

      if (!conversationId) {
        const created = await api.createLiveSession(draftCwdValue || undefined, undefined, createLiveSessionPreferenceInput);
        conversationId = created.id;
      } else {
        conversationId = await ensureConversationIsLive('run bash commands');
      }

      await api.executeLiveSessionBash(conversationId, normalizedCommand, {
        excludeFromContext: command.excludeFromContext,
      });

      if (draft) {
        clearDraftConversationComposer();
        clearDraftConversationAttachments();
        clearDraftConversationCwd();
        clearDraftConversationModelPreferences();
      }

      if (conversationId !== id) {
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
      composerController.setText(inputSnapshot);
      showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
    } finally {
      wholeLineBashRunningRef.current = false;
      setWholeLineBashRunning(false);
      setPendingAssistantStatusLabel(null);
    }
  }

  async function submitComposer(behavior?: 'steer' | 'followUp') {
    if (preparingRelatedThreadContext) {
      return;
    }

    const submitStartedAtMs = performance.now();
    const recordSubmitPhase = (phase: string, startedAtMs: number, meta?: Record<string, unknown>) => {
      recordClientPerfTiming({
        name: 'conversation.submitComposer.phase',
        startedAtMs,
        meta: { phase, draft, hasConversationId: Boolean(id), ...(meta ?? {}) },
      });
    };

    const inputSnapshot = input;
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

    try {
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
            const created = await api.createLiveSession(draftCwdValue || undefined, undefined, createLiveSessionPreferenceInput);
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
        let createdSessionId: string | null = null;
        let navigatedToCreatedConversation = false;
        try {
          const draftPendingPromptPaintStartedAtMs = performance.now();
          await waitForDraftPendingPromptPaint();
          recordSubmitPhase('draftPendingPromptPaintYield', draftPendingPromptPaintStartedAtMs);
          const createStartedAtMs = performance.now();
          const created = await api.createLiveSession(draftCwdValue || undefined, undefined, createLiveSessionPreferenceInput);
          recordSubmitPhase('createLiveSession', createStartedAtMs);
          createdSessionId = created.id;
          const primeCachesStartedAtMs = performance.now();
          primeCreatedConversationOpenCaches(created, {
            tailBlocks: INITIAL_HISTORICAL_TAIL_BLOCKS,
            bootstrapVersionKey: conversationVersionKey,
            sessionDetailVersion: conversationEventVersion,
          });
          recordSubmitPhase('primeCreatedConversationCaches', primeCachesStartedAtMs, { conversationId: created.id });
          const newId = created.id;
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
          setPendingInitialPrompt(initialPrompt);
          setPendingInitialPromptDispatchingState(true);
          recordSubmitPhase('beforeNavigateCreatedConversation', submitStartedAtMs, { conversationId: newId });
          navigate(`/conversations/${newId}`, {
            replace: true,
            state: {
              initialModelPreferenceState: buildConversationInitialModelPreferenceState({
                conversationId: newId,
                currentModel,
                currentThinkingLevel,
                currentServiceTier,
                hasExplicitServiceTier,
                defaultModel,
                defaultThinkingLevel,
                defaultServiceTier,
              }),
              initialDeferredResumeState: {
                conversationId: newId,
                resumes: [],
              },
              preserveConversationSurfaceKey: 'draft',
            },
          });
          recordSubmitPhase('afterNavigateCreatedConversation', submitStartedAtMs, { conversationId: newId });
          navigatedToCreatedConversation = true;

          const dispatchInitialPromptAfterRoutePaint = () => {
            window.setTimeout(() => {
              void api
                .promptSession(
                  newId,
                  initialPrompt.text,
                  initialPrompt.behavior,
                  initialPrompt.images,
                  initialPrompt.attachmentRefs,
                  undefined,
                  initialPrompt.contextMessages,
                )
                .then((sendResult) => {
                  for (const warning of sendResult.relatedConversationPointerWarnings ?? []) {
                    showNotice('danger', warning, 5000);
                  }
                  if (sendResult.accepted) {
                    clearPendingConversationPrompt(newId);
                  }
                })
                .catch((error) => {
                  persistPendingConversationPrompt(newId, initialPrompt);
                  setPendingInitialPrompt(initialPrompt);
                  showNotice('danger', error instanceof Error ? error.message : String(error), 4000);
                })
                .finally(() => {
                  setPendingInitialPromptDispatchingState(false);
                });
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
          await stream.send(textToSend, queuedBehavior, promptImages, attachmentRefs, browserContextMessages);
        } catch (error) {
          if (!isConversationSessionNotLiveError(error)) {
            throw error;
          }

          setConfirmedLive(false);
          const recovered = await api.recoverConversation(id);
          if (recovered.conversationId !== id) {
            ensureConversationTabOpen(recovered.conversationId);
            navigate(`/conversations/${recovered.conversationId}`);
            return;
          }

          setConfirmedLive(true);
          stream.reconnect();
          setPendingAssistantStatusLabel('Resuming…');
          await stream.send(textToSend, queuedBehavior, promptImages, attachmentRefs, browserContextMessages);
        }

        await refetchConversationAttachments();

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
          const recovered = await api.recoverConversation(id);
          if (recovered.conversationId !== id) {
            ensureConversationTabOpen(recovered.conversationId);
            navigate(`/conversations/${recovered.conversationId}`);
            return;
          }
          setConfirmedLive(true);
          stream.reconnect();
          setPendingAssistantStatusLabel('Working…');
          await stream.send(textToSend, queuedBehavior, promptImages, attachmentRefs, browserContextMessages);
          await refetchConversationAttachments();
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
    await streamAbort();

    if (!id || pendingQueue.length === 0) return;

    try {
      const cleared = await api.clearQueuedMessages(id, currentSurfaceId);
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
    const clearShortcut = resolveComposerClearShortcut({
      key: e.key,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      isComposing: e.nativeEvent.isComposing,
      composerInput: input,
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

    if (showModelPicker) {
      if (e.key === 'Escape') {
        e.preventDefault();
        composerController.clear();
        return;
      }
      if (modelItems.length === 0) {
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setModelIdx((i) => (i + 1) % modelItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setModelIdx((i) => (i - 1 + modelItems.length) % modelItems.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const sel = modelItems[modelIdx % modelItems.length];
        if (sel) selectModel(sel.id);
        return;
      }
    }
    if (showSlash || showMention) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        showSlash ? setSlashIdx((i) => i + 1) : setMentionIdx((i) => i + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        showSlash ? setSlashIdx((i) => Math.max(0, i - 1)) : setMentionIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        composerController.clear();
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        if (showSlash && e.key === 'Enter') {
          const exactConversationSlash = parseConversationSlashCommand(input.trim());
          if (exactConversationSlash) {
            e.preventDefault();
            await submitComposer();
            return;
          }
        }

        e.preventDefault();
        if (showSlash) {
          const sel = slashItems[slashIdx % (slashItems.length || 1)];
          if (sel) {
            const parsedSelectedSlash = parseConversationSlashCommand(sel.displayCmd.trim());
            if (parsedSelectedSlash?.kind === 'command') {
              setSlashIdx(0);
              await executeConversationSlashCommand(parsedSelectedSlash.command);
            } else {
              composerController.setText(sel.insertText);
            }
          }
        } else {
          const filtered = filterMentionItems(mentionItems, mentionQuery, { limit: MAX_MENTION_MENU_ITEMS });
          const sel = filtered[mentionIdx % (filtered.length || 1)];
          if (sel) {
            composerController.setText(input.replace(/@[\w./-]*$/, sel.id + ' '));
          }
        }
        return;
      }
    }

    const canUseComposerQuestionHotkeys =
      Boolean(pendingAskUserQuestion) &&
      !composerQuestionSubmitting &&
      input.length === 0 &&
      attachments.length === 0 &&
      drawingAttachments.length === 0 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.nativeEvent.isComposing;

    if (canUseComposerQuestionHotkeys) {
      if (e.key === 'ArrowDown' && composerActiveQuestion) {
        e.preventDefault();
        setComposerQuestionOptionIndex((current) => moveAskUserQuestionIndex(current, composerActiveQuestion.options.length, 1));
        return;
      }

      if (e.key === 'ArrowUp' && composerActiveQuestion) {
        e.preventDefault();
        setComposerQuestionOptionIndex((current) => moveAskUserQuestionIndex(current, composerActiveQuestion.options.length, -1));
        return;
      }

      const optionHotkeyIndex = resolveAskUserQuestionOptionHotkey(e.key);
      if (composerActiveQuestion && optionHotkeyIndex >= 0 && optionHotkeyIndex < composerActiveQuestion.options.length) {
        e.preventDefault();
        handleComposerQuestionOptionSelect(composerQuestionIndex, optionHotkeyIndex);
        return;
      }

      const questionDirection = e.key === 'Tab' ? (e.shiftKey ? -1 : 1) : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (questionDirection !== 0) {
        const pendingPresentation = pendingAskUserQuestion?.presentation;
        if (!pendingPresentation) {
          return;
        }

        e.preventDefault();
        if (questionDirection > 0) {
          if (composerQuestionIndex < pendingPresentation.questions.length - 1) {
            activateComposerQuestion(composerQuestionIndex + 1);
          }
        } else {
          activateComposerQuestion(Math.max(0, composerQuestionIndex - 1));
        }
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && !e.shiftKey) {
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
      if (canNavigateComposerHistory(e.currentTarget, e.key) && navigateComposerHistory(e.key === 'ArrowUp' ? 'older' : 'newer')) {
        e.preventDefault();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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

    const handleComposerAppendTextCommand = (event: Event) => {
      const text = event instanceof CustomEvent && typeof event.detail?.text === 'string' ? event.detail.text : '';
      if (!text.trim()) return;
      composerController.appendText(text);
    };

    window.addEventListener('neon-pilot:composer-focus', handleComposerFocusCommand);
    window.addEventListener('neon-pilot:composer-submit', handleComposerSubmitCommand);
    window.addEventListener('neon-pilot:composer-clear', handleComposerClearCommand);
    window.addEventListener('neon-pilot:composer-append-text', handleComposerAppendTextCommand);
    return () => {
      window.removeEventListener('neon-pilot:composer-focus', handleComposerFocusCommand);
      window.removeEventListener('neon-pilot:composer-submit', handleComposerSubmitCommand);
      window.removeEventListener('neon-pilot:composer-clear', handleComposerClearCommand);
      window.removeEventListener('neon-pilot:composer-append-text', handleComposerAppendTextCommand);
    };
  }, [composerController, composerShowsQuestionSubmit, submitComposerQuestionIfReady, submitComposerActionForModifiers]);
  const composerSubmit = resolveConversationComposerSubmitState(
    composerRunState.streamControlsActive,
    composerAltHeld,
    liveSessionHasStaleTurnState,
  );
  const showScrollToBottomControl = shouldShowScrollToBottomControl(messageCount, atBottom);
  const renameConversationDisabled = conversationNeedsTakeover || conversationCwdEditorOpen || conversationCwdBusy;
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
  const composerChromeConversationKeyRef = useRef<string | null>(draft ? 'draft' : (id ?? null));

  useEffect(() => {
    const conversationKey = draft ? 'draft' : (id ?? null);
    if (composerChromeConversationKeyRef.current !== conversationKey) {
      composerChromeConversationKeyRef.current = conversationKey;
      setComposerChromeReady(draft);
    }

    if (draft) {
      setComposerChromeReady(true);
      return;
    }

    if (!id || composerChromeReady || !hasRenderableMessages || showConversationLoadingState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setComposerChromeReady(true);
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [composerChromeReady, draft, hasRenderableMessages, id, showConversationLoadingState]);

  const hasComposerShelfContent =
    composerChromeReady &&
    hasConversationComposerShelfContent({
      composerShelvesTopCount: composerShelvesTop.length,
      composerShelvesBottomCount: composerShelvesBottom.length,
      attachedContextDocsCount: attachedContextDocs.length,
      draftMentionItemsCount: draftMentionItems.length,
      pendingQueueCount: pendingQueue.length,
      visibleBackgroundExecutionsCount: visibleActiveConversationBackgroundExecutions.length,
      draft,
      orderedDeferredResumesCount: orderedDeferredResumes.length,
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
  const visibleTranscriptCount = visibleTranscriptMessages?.length ?? 0;
  const visibleTranscriptHasOlderBlocks =
    !showConversationLoadingState && !draft && Boolean(id) && visibleTranscriptState?.conversationId === id && showHistoricalLoadMore;
  const visibleTranscriptStartPercent =
    visibleTranscriptTotalBlocks > 0
      ? Math.min(100, Math.max(0, Math.ceil((visibleTranscriptMessageIndexOffset / visibleTranscriptTotalBlocks) * 100)))
      : 0;
  const visibleTranscriptEndPercent =
    visibleTranscriptTotalBlocks > 0
      ? Math.min(
          100,
          Math.max(
            visibleTranscriptStartPercent,
            Math.ceil(((visibleTranscriptMessageIndexOffset + visibleTranscriptCount) / visibleTranscriptTotalBlocks) * 100),
          ),
        )
      : 100;
  const previousTranscriptPercent = Math.min(HISTORICAL_TAIL_BLOCKS_STEP_PERCENT, Math.max(1, visibleTranscriptStartPercent));
  const previousTranscriptBlockStep = Math.max(1, Math.ceil((visibleTranscriptTotalBlocks * previousTranscriptPercent) / 100));
  const renderingStaleTranscript = Boolean(visibleTranscriptState?.conversationId && id && visibleTranscriptState.conversationId !== id);
  const showInlineConversationLoadingState = shouldShowConversationInlineLoadingState({
    showConversationLoadingState,
    hasVisibleTranscript: Boolean(visibleTranscriptMessages?.length),
  });
  const showBlockingConversationLoadingState = showConversationLoadingState && !showInlineConversationLoadingState;

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
          style={{ scrollPaddingTop: `${conversationHeaderOffset + 16}px` }}
        >
          <div ref={conversationHeaderRef} className="sticky top-0 z-30 bg-base/90 px-8 pt-6 backdrop-blur sm:px-10">
            <div className="mx-auto w-full max-w-6xl pb-4 pt-1">
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
                      <input
                        ref={titleInputRef}
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelTitleEdit();
                          }
                        }}
                        placeholder="Name this conversation"
                        className="min-w-0 flex-1 rounded-2xl border border-transparent bg-transparent px-3 py-2 text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-primary outline-none transition-colors placeholder:text-dim/60 hover:border-border-subtle/70 hover:bg-base/25 focus:border-accent/45 focus:bg-base/35 sm:text-[34px]"
                        disabled={titleSaving}
                      />
                      <button
                        type="submit"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-accent/10 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={titleSaving}
                        title={titleSaving ? 'Saving…' : 'Save title'}
                        aria-label={titleSaving ? 'Saving title' : 'Save title'}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition-colors hover:bg-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
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
                      </button>
                    </form>
                  ) : draft ? (
                    <h1 className="ui-conversation-title-clamp max-w-4xl break-words pr-4 text-[30px] font-semibold leading-[1.05] tracking-[-0.04em] text-primary sm:text-[34px]">
                      {title}
                    </h1>
                  ) : (
                    <Suspense fallback={<h1 className="ui-conversation-title-clamp text-[30px] font-semibold">{title}</h1>}>
                      <ConversationSavedHeader
                        title={title}
                        cwd={currentCwd}
                        onTitleClick={!renameConversationDisabled ? beginTitleEdit : undefined}
                        cwdEditing={false}
                        cwdDraft={conversationCwdDraft}
                        cwdError={null}
                        cwdSaveBusy={conversationCwdBusy}
                        onCwdDraftChange={(value) => {
                          setConversationCwdDraft(value);
                          if (conversationCwdError) {
                            setConversationCwdError(null);
                          }
                        }}
                        onCancelEditingCwd={cancelConversationCwdEdit}
                        onSaveCwd={() => {
                          void submitConversationCwdChange();
                        }}
                      />
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
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-warning">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Session file was modified outside the agent. Some context may be stale.</span>
                </div>
              )}
            </div>
          </div>
          {showBlockingConversationLoadingState ? (
            <LoadingState label="Loading messages…" className="justify-center h-full" />
          ) : visibleTranscriptMessages ? (
            <Suspense fallback={<LoadingState label="Loading messages…" className="justify-center h-full" />}>
              <ChatView
                key={visibleTranscriptState?.conversationId ?? id ?? 'draft-conversation'}
                conversationId={visibleTranscriptState?.conversationId ?? id ?? null}
                messages={visibleTranscriptMessages}
                systemPrompt={isLiveSession ? stream.systemPrompt : null}
                toolDefinitions={isLiveSession ? stream.toolDefinitions : []}
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
                onOpenFilePath={renderingStaleTranscript ? undefined : openKnowledgeFilePath}
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
                      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full bg-surface/90 px-3 py-1.5 shadow-sm">
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
                        <button
                          type="button"
                          onClick={() => loadOlderMessages(undefined, { tailBlockStep: previousTranscriptBlockStep })}
                          disabled={sessionLoading}
                          className="font-medium text-accent hover:text-primary disabled:pointer-events-none disabled:text-secondary/60"
                        >
                          {sessionLoading ? 'Loading earlier…' : `Load previous ${previousTranscriptPercent}%`}
                        </button>
                      </div>
                      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border-subtle to-border-subtle" aria-hidden />
                    </div>
                  ) : undefined
                }
                anchorWindowingToTail={atBottom}
              />
            </Suspense>
          ) : (
            <AppPageEmptyState
              align={draft ? 'start' : 'center'}
              className={draft ? 'px-4 pt-12 sm:px-6' : undefined}
              contentClassName={draft ? `${DRAFT_EMPTY_STATE_CONTENT_WIDTH_CLASS} text-left` : undefined}
              icon={
                draft ? undefined : (
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto">
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
                draft ? (
                  <span className="sr-only">Choose a workspace</span>
                ) : isLiveSession ? (
                  'No messages yet'
                ) : (
                  'This conversation is empty'
                )
              }
              body={
                draft
                  ? undefined
                  : isLiveSession
                    ? 'This conversation is live but has no messages yet. Send a prompt to get started.'
                    : 'Start a Pi session to populate this conversation.'
              }
              action={
                draft ? (
                  <ConversationDraftEmptyAction
                    hasDraftCwd={hasDraftCwd}
                    draftCwdValue={draftCwdValue}
                    draftCwdError={draftCwdError}
                    draftCwdPickBusy={draftCwdPickBusy}
                    savedWorkspacePathsLoading={savedWorkspacePathsLoading}
                    availableDraftWorkspacePaths={availableDraftWorkspacePaths}
                    onClearDraftCwdSelection={clearDraftConversationCwdSelection}
                    onSelectDraftWorkspace={selectDraftConversationWorkspace}
                    onPickDraftCwd={() => {
                      void pickDraftConversationCwd();
                    }}
                    extensionPanels={newConversationPanels.map((panel) => (
                      <NewConversationPanelHost
                        key={`${panel.extensionId}:${panel.id}`}
                        registration={panel}
                        panelContext={newConversationPanelContext}
                      />
                    ))}
                  />
                ) : undefined
              }
            />
          )}
        </div>
        {!showConversationLoadingState && showScrollToBottomControl && (
          <button
            onClick={() => {
              scrollToBottom({ behavior: 'smooth', force: true });
            }}
            className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 ui-pill ui-pill-muted shadow-md"
          >
            ↓ scroll to bottom
          </button>
        )}
        {showInlineConversationLoadingState && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-base/85 px-6 py-4 backdrop-blur-sm">
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
      hasRenderableMessages,
      hydrateHistoricalBlock,
      hydratingHistoricalBlockIdSet,
      id,
      isLiveSession,
      jumpToMessage,
      loadOlderMessages,
      openArtifact,
      openCheckpoint,
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
      showScrollToBottomControl,
      stream.isCompacting,
      conversationRunningForPage,
      conversationPerformanceMode,
      submitAskUserQuestion,
      visibleTranscriptStartPercent,
      visibleTranscriptEndPercent,
      previousTranscriptPercent,
      previousTranscriptBlockStep,
      availableDraftWorkspacePaths,
      hasDraftCwd,
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
      conversationHeaderOffset,
      currentCwd,
      isEditingTitle,
      renameConversationDisabled,
      saveTitleEdit,
      submitConversationCwdChange,
      title,
      titleDraft,
      titleSaving,
      visibleTranscriptHasOlderBlocks,
      visibleTranscriptMessageIndexOffset,
      visibleTranscriptMessages,
      visibleTranscriptState?.conversationId,
      newConversationPanelContext,
      newConversationPanels,
    ],
  );

  const missingConversation = shouldShowMissingConversationState({
    draft,
    conversationId: id,
    sessionsLoaded,
    confirmedLive,
    sessionLoading,
    hasVisibleSessionDetail: Boolean(visibleSessionDetail),
    hasSavedConversationSessionFile: Boolean(savedConversationSessionFile),
    hasPendingInitialPrompt: Boolean(pendingInitialPrompt),
  });

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
    <div className="flex h-full flex-col overflow-hidden">
      {transcriptPane}

      {/* Input area */}
      {!keyboardOpen && (
        <div
          className={`bg-gradient-to-t from-base via-base to-transparent px-8 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] transition-colors sm:px-10 ${dragOver ? 'bg-accent/5' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {notice && (
            <div className="mb-2 text-center">
              <Pill tone={notice.tone}>{notice.text}</Pill>
            </div>
          )}

          <div className="relative mx-auto w-full max-w-6xl">
            {showSlash && (
              <SlashMenu
                items={slashItems}
                idx={slashIdx}
                onSelect={(item) => {
                  const c = item.displayCmd.trim();
                  const parsedConversationSlash = parseConversationSlashCommand(c);
                  if (parsedConversationSlash?.kind === 'command') {
                    setSlashIdx(0);
                    void executeConversationSlashCommand(parsedConversationSlash.command);
                    return;
                  }
                  composerController.setText(item.insertText);
                }}
              />
            )}
            {showMention && (
              <MentionMenu
                items={mentionItems}
                query={mentionQuery}
                idx={mentionIdx}
                onSelect={(id) => {
                  composerController.setText(input.replace(/@[\w./-]*$/, id + ' '));
                }}
              />
            )}
            {showModelPicker && (
              <ModelPicker
                models={modelItems}
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

            {hasComposerAttachmentShelfContent && (
              <div className="mb-2 max-h-[min(34vh,20rem)] overflow-y-auto overscroll-contain">
                {composerAttachmentProviders.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {composerAttachmentProviders.map((provider) => (
                      <button
                        key={`${provider.extensionId}:${provider.id}`}
                        type="button"
                        className="ui-toolbar-button px-2 py-1 text-[11px]"
                        onClick={() => {
                          void invokeComposerAttachmentProvider(provider);
                        }}
                      >
                        {provider.icon ? <span aria-hidden="true">{provider.icon}</span> : null}
                        <span>{provider.title}</span>
                      </button>
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

            {showTextOnlyImageHint ? (
              <p className="mb-2 text-[12px] text-secondary">Set a vision model in Settings to inspect attached images.</p>
            ) : null}

            <div
              className={cx(
                'ui-input-shell',
                resolveConversationComposerShellStateClassName({
                  dragOver,
                  hasInteractiveOverlay: showModelPicker || showSlash || showMention,
                  streamIsStreaming: composerRunState.streamControlsActive,
                }),
              )}
              ref={composerShellRef}
            >
              {/* Drag overlay hint */}
              {dragOver && (
                <div className="px-4 py-3 text-center text-[12px] text-accent border-b border-accent/20">📎 Drop files to attach</div>
              )}

              {composerChromeReady ? (
                <ConversationGoalPanel
                  goal={stream.goalState}
                  workingLabel={goalEnabled && conversationRunningForPage ? 'Working…' : null}
                />
              ) : null}

              {hasComposerShelfContent && (
                <div className="max-h-[min(34vh,20rem)] overflow-y-auto overscroll-contain">
                  {composerShelvesTop.map((shelf) => (
                    <ComposerShelfHost key={`${shelf.extensionId}:${shelf.id}`} registration={shelf} shelfContext={composerShelfContext} />
                  ))}
                  {pendingBrowserComments.length > 0 ? (
                    <div className="border-b border-border-subtle/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dim">Browser comments</p>
                        <button
                          type="button"
                          className="ui-toolbar-button px-2 py-1 text-[11px]"
                          onClick={() => setPendingBrowserComments([])}
                        >
                          Clear
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {pendingBrowserComments.map((entry) => (
                          <div
                            key={entry.id}
                            className="group flex max-w-full items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2 py-1 text-[11px] text-secondary"
                          >
                            <span className="max-w-[26rem] truncate text-primary">{formatBrowserCommentTargetLabel(entry.target)}</span>
                            <span className="max-w-[20rem] truncate">{entry.comment}</span>
                            <button
                              type="button"
                              className="ml-1 text-dim hover:text-primary"
                              aria-label="Remove browser comment"
                              onClick={() => setPendingBrowserComments((current) => current.filter((comment) => comment.id !== entry.id))}
                            >
                              ×
                            </button>
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
                      pendingQueue={pendingQueue}
                      conversationNeedsTakeover={conversationNeedsTakeover}
                      onRestoreQueuedPrompt={(behavior, queueIndex, previewId) => {
                        void restoreQueuedPromptToComposer(behavior, queueIndex, previewId);
                      }}
                    />
                  </Suspense>

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
                </div>
              )}

              <ConversationComposerInputControls
                fileInputRef={fileInputRef}
                textareaRef={textareaRef}
                input={input}
                pendingAskUserQuestion={Boolean(pendingAskUserQuestion)}
                composerDisabled={composerDisabled}
                composerShellWidth={composerShellWidth}
                streamIsStreaming={composerRunState.streamControlsActive}
                models={models}
                currentModel={currentModel || model || defaultModel}
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
            </div>

            {showComposerMeta ? (
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
                onConversationCwdDraftChange={(value) => {
                  setConversationCwdDraft(value);
                  if (conversationCwdError) {
                    setConversationCwdError(null);
                  }
                }}
                onSubmitConversationCwdChange={() => {
                  void submitConversationCwdChange();
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
            ) : null}
          </div>
        </div>
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
