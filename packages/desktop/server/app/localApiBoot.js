// Thin bootstrap for the desktop local API server (~5KB, loads in ~5ms).
// This file has ZERO imports — it's a plain JS module that dynamically
// imports the full handler module on first API call.
//
// The build copies this file directly to server/dist/app/localApi.js
// without going through esbuild, avoiding bundling of unnecessary deps.

// ── Handler loader — starts loading immediately, not on first call ────────

let fullModule = null;
let modulePromise = null;
const FULL_MODULE_PATH = './localApiFull.js';

// Start loading the full module eagerly in the background as soon as this
// bootstrap loads (~5ms). By the time the first API call arrives (~400ms
// later), the full module will likely be ready, avoiding lazy-load latency.
modulePromise = import(FULL_MODULE_PATH).then((mod) => {
  fullModule = mod;
}).catch((err) => {
  // Failed to load — log to stderr and leave fullModule as null.
  // Lazy callers will await modulePromise and re-throw the error.
  process.stderr.write(`[local-api-boot] failed to load full module: ${err.message}\n`);
});

async function ensureModule() {
  if (fullModule) return fullModule;
  await modulePromise;
  return fullModule;
}

/**
 * Returns a thin wrapper function that lazy-loads the real handler.
 * Each wrapper is ~120 bytes — 85 of them fit in ~10KB.
 */
function lazy(name) {
  return async (...args) => {
    const mod = await ensureModule();
    const fn = mod[name];
    if (typeof fn !== 'function') {
      throw new Error(`Unknown local API method: ${name}`);
    }
    return fn(...args);
  };
}

// ── Named exports (each lazily delegates to the full module) ────────────────

// Dispatch handles routing for all /api/ endpoints. We intercept /api/health
// here to respond immediately without loading the full module.
export async function dispatchDesktopLocalApiRequest(input) {
  if (input.path === '/api/health') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.from(JSON.stringify({
        ok: true,
        daemonHealthy: true,
        apiReady: fullModule !== null,
      }), 'utf-8'),
    };
  }
  const mod = await ensureModule();
  return mod.dispatchDesktopLocalApiRequest(input);
}
export const subscribeDesktopLocalApiStream = lazy('subscribeDesktopLocalApiStream');
export const subscribeDesktopAppEvents = lazy('subscribeDesktopAppEvents');

export const readDesktopAppStatus = lazy('readDesktopAppStatus');
export const readDesktopDaemonState = lazy('readDesktopDaemonState');
export const readDesktopSessions = lazy('readDesktopSessions');
export const readDesktopSessionMeta = lazy('readDesktopSessionMeta');
export const readDesktopSessionDetail = lazy('readDesktopSessionDetail');
export const readDesktopSessionBlock = lazy('readDesktopSessionBlock');
export const readDesktopSessionEntryBlocks = lazy('readDesktopSessionEntryBlocks');
export const readDesktopSessionSearchIndex = lazy('readDesktopSessionSearchIndex');
export const readDesktopModels = lazy('readDesktopModels');
export const readDesktopModelProviders = lazy('readDesktopModelProviders');
export const readDesktopProviderAuth = lazy('readDesktopProviderAuth');
export const readDesktopDefaultCwd = lazy('readDesktopDefaultCwd');
export const readDesktopProviderOAuthLogin = lazy('readDesktopProviderOAuthLogin');
export const readDesktopOpenConversationTabs = lazy('readDesktopOpenConversationTabs');
export const readDesktopScheduledTasks = lazy('readDesktopScheduledTasks');
export const readDesktopScheduledTaskDetail = lazy('readDesktopScheduledTaskDetail');
export const readDesktopScheduledTaskLog = lazy('readDesktopScheduledTaskLog');
export const readDesktopScheduledTaskSchedulerHealth = lazy('readDesktopScheduledTaskSchedulerHealth');
export const readDesktopDurableRuns = lazy('readDesktopDurableRuns');
export const readDesktopDurableRun = lazy('readDesktopDurableRun');
export const readDesktopDurableRunLog = lazy('readDesktopDurableRunLog');
export const readDesktopConversationBootstrap = lazy('readDesktopConversationBootstrap');
export const readDesktopConversationModelPreferences = lazy('readDesktopConversationModelPreferences');
export const readDesktopConversationDeferredResumes = lazy('readDesktopConversationDeferredResumes');
export const readDesktopConversationArtifacts = lazy('readDesktopConversationArtifacts');
export const readDesktopConversationArtifact = lazy('readDesktopConversationArtifact');
export const readDesktopConversationCheckpoints = lazy('readDesktopConversationCheckpoints');
export const readDesktopConversationCheckpoint = lazy('readDesktopConversationCheckpoint');
export const readDesktopConversationAttachments = lazy('readDesktopConversationAttachments');
export const readDesktopConversationAttachment = lazy('readDesktopConversationAttachment');
export const readDesktopConversationAttachmentAsset = lazy('readDesktopConversationAttachmentAsset');
export const readDesktopConversationPlansWorkspace = lazy('readDesktopConversationPlansWorkspace');
export const readDesktopLiveSession = lazy('readDesktopLiveSession');
export const readDesktopLiveSessionForkEntries = lazy('readDesktopLiveSessionForkEntries');
export const readDesktopLiveSessionContext = lazy('readDesktopLiveSessionContext');
export const updateDesktopModelPreferences = lazy('updateDesktopModelPreferences');
export const updateDesktopDefaultCwd = lazy('updateDesktopDefaultCwd');
export const updateDesktopOpenConversationTabs = lazy('updateDesktopOpenConversationTabs');
export const updateDesktopConversationModelPreferences = lazy('updateDesktopConversationModelPreferences');
export const updateDesktopScheduledTask = lazy('updateDesktopScheduledTask');
export const updateDesktopConversationAttachment = lazy('updateDesktopConversationAttachment');
export const updateDesktopConversationGoal = lazy('updateDesktopConversationGoal');
export const createDesktopLiveSession = lazy('createDesktopLiveSession');
export const createDesktopScheduledTask = lazy('createDesktopScheduledTask');
export const createDesktopConversationAttachment = lazy('createDesktopConversationAttachment');
export const createDesktopConversationCheckpoint = lazy('createDesktopConversationCheckpoint');
export const deleteDesktopScheduledTask = lazy('deleteDesktopScheduledTask');
export const deleteDesktopModelProvider = lazy('deleteDesktopModelProvider');
export const deleteDesktopModelProviderModel = lazy('deleteDesktopModelProviderModel');
export const deleteDesktopConversationAttachment = lazy('deleteDesktopConversationAttachment');
export const renameDesktopConversation = lazy('renameDesktopConversation');
export const changeDesktopConversationCwd = lazy('changeDesktopConversationCwd');
export const resumeDesktopLiveSession = lazy('resumeDesktopLiveSession');
export const submitDesktopLiveSessionPrompt = lazy('submitDesktopLiveSessionPrompt');
export const submitDesktopLiveSessionParallelPrompt = lazy('submitDesktopLiveSessionParallelPrompt');
export const executeDesktopLiveSessionBash = lazy('executeDesktopLiveSessionBash');
export const abortDesktopLiveSession = lazy('abortDesktopLiveSession');
export const scheduleDesktopConversationDeferredResume = lazy('scheduleDesktopConversationDeferredResume');
export const cancelDesktopConversationDeferredResume = lazy('cancelDesktopConversationDeferredResume');
export const fireDesktopConversationDeferredResume = lazy('fireDesktopConversationDeferredResume');
export const forkDesktopLiveSession = lazy('forkDesktopLiveSession');
export const forkDesktopConversation = lazy('forkDesktopConversation');
export const branchDesktopLiveSession = lazy('branchDesktopLiveSession');
export const takeOverDesktopLiveSession = lazy('takeOverDesktopLiveSession');
export const restoreDesktopQueuedLiveSessionMessage = lazy('restoreDesktopQueuedLiveSessionMessage');
export const clearDesktopQueuedLiveSessionMessages = lazy('clearDesktopQueuedLiveSessionMessages');
export const compactDesktopLiveSession = lazy('compactDesktopLiveSession');
export const exportDesktopLiveSession = lazy('exportDesktopLiveSession');
export const reloadDesktopLiveSession = lazy('reloadDesktopLiveSession');
export const destroyDesktopLiveSession = lazy('destroyDesktopLiveSession');
export const recoverDesktopConversation = lazy('recoverDesktopConversation');
export const manageDesktopLiveSessionParallelJob = lazy('manageDesktopLiveSessionParallelJob');
export const markDesktopConversationAttention = lazy('markDesktopConversationAttention');
export const markDesktopDurableRunAttention = lazy('markDesktopDurableRunAttention');
export const prewarmDesktopLiveSessionOptions = lazy('prewarmDesktopLiveSessionOptions');
export const saveDesktopModelProvider = lazy('saveDesktopModelProvider');
export const saveDesktopModelProviderModel = lazy('saveDesktopModelProviderModel');
export const setDesktopProviderApiKey = lazy('setDesktopProviderApiKey');
export const removeDesktopProviderCredential = lazy('removeDesktopProviderCredential');
export const startDesktopProviderOAuthLogin = lazy('startDesktopProviderOAuthLogin');
export const cancelDesktopProviderOAuthLogin = lazy('cancelDesktopProviderOAuthLogin');
export const submitDesktopProviderOAuthLoginInput = lazy('submitDesktopProviderOAuthLoginInput');
export const subscribeDesktopProviderOAuthLogin = lazy('subscribeDesktopProviderOAuthLogin');
export const pickDesktopFolder = lazy('pickDesktopFolder');
export const invokeDesktopLocalApi = lazy('invokeDesktopLocalApi');
export const cancelDesktopDurableRun = lazy('cancelDesktopDurableRun');
export const runDesktopScheduledTask = lazy('runDesktopScheduledTask');
export const setDesktopWorkbenchBrowserToolHost = lazy('setDesktopWorkbenchBrowserToolHost');
export const rollbackDesktopConversation = lazy('rollbackDesktopConversation');
export const normalizeDesktopLocalApiTailBlocks = lazy('normalizeDesktopLocalApiTailBlocks');
