import {
  recordRendererTelemetry
} from "./chunk-2N3GWURJ.js";
import {
  createContext,
  init_neon_pilot_shared_react,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "./chunk-TTFLGCWD.js";

// packages/desktop/ui/src/client/perfDiagnostics.ts
var MAX_PERF_SAMPLES = 120;
var CLIENT_PERF_TELEMETRY_MIN_DURATION_MS = 16;
var CHAT_RENDER_TELEMETRY_MIN_DURATION_MS = 16;
var perfStore = {
  apiSamples: [],
  conversationOpenSamples: [],
  chatRenderSamples: [],
  streamCadenceSamples: [],
  clientSamples: [],
  longTaskSamples: [],
  interactionSamples: [],
  activityTreeRenderSamples: []
};
var activityTreeRenderFrameScheduled = false;
var pendingActivityTreeRenderCounts = /* @__PURE__ */ new Map();
publishPerfStore();
function appendSample(samples, sample) {
  samples.push(sample);
  while (samples.length > MAX_PERF_SAMPLES) {
    samples.shift();
  }
}
function getGlobalPerfTarget() {
  return globalThis;
}
function publishPerfStore() {
  getGlobalPerfTarget().__NEON_PILOT_APP_PERF__ = perfStore;
}
function shouldLogPerfSamples() {
  try {
    return globalThis.localStorage?.getItem("neonPilot.debugPerf") === "1";
  } catch {
    return false;
  }
}
function safeParsePerfMeta(value) {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function recordChatRenderTiming(input) {
  const endTimeMs = performance.now();
  const sample = {
    conversationId: input.conversationId ?? null,
    route: input.route ?? null,
    recordedAt: (/* @__PURE__ */ new Date()).toISOString(),
    startTimeMs: Math.max(0, input.startedAtMs),
    endTimeMs,
    durationMs: Math.max(0, endTimeMs - input.startedAtMs),
    meta: input.meta
  };
  appendSample(perfStore.chatRenderSamples, sample);
  publishPerfStore();
  if (sample.durationMs >= CHAT_RENDER_TELEMETRY_MIN_DURATION_MS) {
    recordRendererTelemetry({
      category: "renderer_performance",
      name: "chat_render",
      route: sample.route ?? void 0,
      sessionId: sample.conversationId ?? void 0,
      durationMs: Math.round(sample.durationMs),
      metadata: summarizeChatRenderSample(sample)
    });
  }
  if (shouldLogPerfSamples()) {
    console.info("[pa-perf][chat-render]", sample);
  }
}
function recordClientPerfTiming(input) {
  const endTimeMs = performance.now();
  const durationMs = Math.max(0, endTimeMs - input.startedAtMs);
  if (input.minDurationMs !== void 0 && durationMs < input.minDurationMs) {
    return;
  }
  const sample = {
    name: input.name,
    recordedAt: (/* @__PURE__ */ new Date()).toISOString(),
    startTimeMs: Math.max(0, input.startedAtMs),
    endTimeMs,
    durationMs,
    route: `${globalThis.location?.pathname ?? ""}${globalThis.location?.search ?? ""}`,
    ...input.meta ? { meta: input.meta } : {}
  };
  appendSample(perfStore.clientSamples, sample);
  publishPerfStore();
  if (sample.durationMs >= CLIENT_PERF_TELEMETRY_MIN_DURATION_MS) {
    recordRendererTelemetry({
      category: "renderer_performance",
      name: "client_work",
      route: sample.route ?? void 0,
      durationMs: Math.round(sample.durationMs),
      metadata: summarizeClientSample(sample)
    });
  }
  if (shouldLogPerfSamples()) {
    console.info("[pa-perf][client]", sample);
  }
}
function measureClientPerfTiming(input, fn) {
  const startedAtMs = performance.now();
  try {
    return fn();
  } finally {
    recordClientPerfTiming({ ...input, startedAtMs });
  }
}
function summarizeClientSample(sample) {
  return {
    name: sample.name,
    startTimeMs: Math.round(sample.startTimeMs),
    endTimeMs: Math.round(sample.endTimeMs),
    durationMs: Math.round(sample.durationMs),
    route: sample.route,
    ...sample.meta ? { meta: sample.meta } : {}
  };
}
function summarizeChatRenderSample(sample) {
  return {
    conversationId: sample.conversationId,
    route: sample.route,
    startTimeMs: Math.round(sample.startTimeMs),
    endTimeMs: Math.round(sample.endTimeMs),
    durationMs: Math.round(sample.durationMs),
    meta: sample.meta
  };
}
function recordExtensionRegistryUsability(input) {
  perfStore.extensionRegistryLoading = input.loading;
  if (!input.loading) {
    perfStore.extensionRegistryLoadedAt = (/* @__PURE__ */ new Date()).toISOString();
    perfStore.extensionRegistryLoadedAtMs = performance.now();
    perfStore.extensionRegistryCounts = input.counts ?? {};
  }
  publishPerfStore();
}
function recordApiTiming(path, res, startedAtMs) {
  if (!res) return;
  const serverTiming = res.headers.get("Server-Timing");
  const meta = safeParsePerfMeta(res.headers.get("X-PA-Perf"));
  if (!serverTiming && !meta) {
    return;
  }
  const endTimeMs = typeof startedAtMs === "number" ? performance.now() : void 0;
  const sample = {
    path,
    recordedAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...typeof startedAtMs === "number" && typeof endTimeMs === "number" ? { startTimeMs: startedAtMs, endTimeMs, durationMs: Math.max(0, endTimeMs - startedAtMs) } : {},
    serverTiming,
    meta
  };
  appendSample(perfStore.apiSamples, sample);
  publishPerfStore();
  if (shouldLogPerfSamples()) {
    console.info("[pa-perf][api]", sample);
  }
}
function recordActivityTreeRowRender(itemId) {
  pendingActivityTreeRenderCounts.set(itemId, (pendingActivityTreeRenderCounts.get(itemId) ?? 0) + 1);
  if (activityTreeRenderFrameScheduled || typeof globalThis.requestAnimationFrame !== "function") {
    return;
  }
  activityTreeRenderFrameScheduled = true;
  globalThis.requestAnimationFrame(() => {
    activityTreeRenderFrameScheduled = false;
    const itemRenderCounts = [...pendingActivityTreeRenderCounts.entries()].map(([renderedItemId, count]) => ({
      itemId: renderedItemId,
      count
    }));
    pendingActivityTreeRenderCounts.clear();
    const sample = {
      route: `${globalThis.location?.pathname ?? ""}${globalThis.location?.search ?? ""}`,
      recordedAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalRenderCount: itemRenderCounts.reduce((total, item) => total + item.count, 0),
      itemRenderCounts
    };
    appendSample(perfStore.activityTreeRenderSamples, sample);
    publishPerfStore();
  });
}

// packages/desktop/ui/src/desktop/desktopBridge.ts
var DESKTOP_WORKBENCH_BROWSER_COMMENT_EVENT = "neon-pilot-desktop-workbench-browser-comment";
function getDesktopBridge() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.neonPilotDesktop ?? null;
}

// packages/desktop/ui/src/client/endpoints.ts
function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
var desktopWebSocketBaseUrl = (() => {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return normalizeBaseUrl(`${protocol}//${window.location.host}`);
})();
function buildDesktopHttpUrl(path) {
  return path.startsWith("/") ? path : `/${path}`;
}

// packages/desktop/ui/src/client/apiBase.ts
var DESKTOP_API_PREFIX = "/api";
function resolveApiPrefix(_pathname) {
  return DESKTOP_API_PREFIX;
}
function buildApiPath(path, pathname) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const currentPathname = pathname ?? (typeof window === "undefined" ? void 0 : window.location?.pathname);
  return buildDesktopHttpUrl(`${resolveApiPrefix(currentPathname)}${normalizedPath}`);
}

// packages/desktop/ui/src/client/api.ts
var RETRY_DELAYS_MS = [1e3, 2e3, 4e3, 8e3];
var RETRYABLE_STATUS_CODES = [502, 503, 504];
function isTransientNetworkError(error) {
  if (error instanceof TypeError && /failed to fetch|network|ECONNREFUSED|ECONNRESET/i.test(error.message)) {
    return true;
  }
  return false;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithRetry(input, init) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(input, init);
      if (!res) throw new Error("fetch returned undefined");
      if (!res.ok && RETRYABLE_STATUS_CODES.includes(res.status) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      return res;
    } catch (error) {
      if (isTransientNetworkError(error) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw error;
    }
  }
}
async function requestJson(method, path, body) {
  const requestPath = buildApiPath(path);
  const startedAtMs = performance.now();
  const res = await fetchWithRetry(requestPath, {
    method,
    ...method === "GET" ? { cache: "no-store" } : {
      headers: { "Content-Type": "application/json" },
      body: body !== void 0 ? JSON.stringify(body) : void 0
    }
  });
  recordApiTiming(requestPath, res, startedAtMs);
  if (!res.ok) throw new Error(await readApiError(res, requestPath));
  return readJsonResponse(res, requestPath);
}
async function requestDesktopLocalApiJson(method, path, body) {
  return requestJson(method, path, body);
}
async function extensionGet(path) {
  return requestDesktopLocalApiJson("GET", path);
}
async function extensionPost(path, body) {
  return requestDesktopLocalApiJson("POST", path, body);
}
async function extensionPut(path, body) {
  return requestDesktopLocalApiJson("PUT", path, body);
}
async function extensionPatch(path, body) {
  return requestDesktopLocalApiJson("PATCH", path, body);
}
async function extensionDelete(path) {
  return requestDesktopLocalApiJson("DELETE", path);
}
async function get(path) {
  return requestJson("GET", path);
}
async function post(path, body) {
  return requestJson("POST", path, body);
}
async function put(path, body) {
  return requestJson("PUT", path, body);
}
async function patch(path, body) {
  return requestJson("PATCH", path, body);
}
async function del(path) {
  return requestJson("DELETE", path);
}
function formatResponsePreview(text) {
  return text.trim().replace(/\s+/g, " ").slice(0, 160);
}
async function readJsonResponse(res, path) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const contentType = res.headers.get("Content-Type") ?? "unknown content type";
    const preview = formatResponsePreview(text);
    throw new Error(`Expected JSON from ${path}, received ${contentType}${preview ? `: ${preview}` : ""}`);
  }
}
async function readApiError(res, path) {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (typeof data === "object" && data !== null && "error" in data) {
      const message = data.error;
      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }
    }
  } catch {
  }
  const preview = formatResponsePreview(text);
  const contentType = (res.headers.get("Content-Type") ?? "").toLowerCase();
  if (preview && contentType.startsWith("text/plain")) {
    return preview;
  }
  return `${res.status} ${res.statusText}${path ? ` from ${path}` : ""}${preview ? `: ${preview}` : ""}`;
}
var pendingMemoryRequests = /* @__PURE__ */ new Map();
var pendingExtensionActionPaths = /* @__PURE__ */ new Map();
async function requireDesktopBridge(action) {
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    return desktopBridge;
  }
  throw new Error(`${action} requires the desktop shell.`);
}
async function getMemoryData() {
  const cacheKey = "__current__";
  const pending = pendingMemoryRequests.get(cacheKey);
  if (pending) {
    return pending;
  }
  const request = resolveExtensionActionPathByRouteCapability("knowledgeFiles", "readMemory").then((actionPath) => extensionPost(actionPath, {})).then((response) => {
    if (response.ok === false) {
      throw new Error(response.error || "Knowledge data is unavailable.");
    }
    return response.result;
  }).finally(() => {
    pendingMemoryRequests.delete(cacheKey);
  });
  pendingMemoryRequests.set(cacheKey, request);
  return request;
}
function extensionHasRouteCapability(extension, capability) {
  return Boolean(
    extension.manifest.contributes?.views?.some((view) => view.routeCapabilities?.includes(capability)) || extension.surfaces?.some((surface) => surface.routeCapabilities?.includes(capability))
  );
}
async function resolveExtensionActionPathByRouteCapability(capability, actionId) {
  const cacheKey = `${capability}:${actionId}`;
  const pending = pendingExtensionActionPaths.get(cacheKey);
  if (pending) return pending;
  const request = api.extensionInstallations().then((extensions) => {
    const extension = extensions.find(
      (candidate) => candidate.enabled && extensionHasRouteCapability(candidate, capability) && (candidate.backendActions ?? candidate.manifest.backend?.actions ?? []).some((action) => action.id === actionId)
    );
    if (!extension) {
      throw new Error(`No enabled extension provides ${capability}.${actionId}.`);
    }
    return `/extensions/${encodeURIComponent(extension.id)}/actions/${encodeURIComponent(actionId)}`;
  }).finally(() => {
    pendingExtensionActionPaths.delete(cacheKey);
  });
  pendingExtensionActionPaths.set(cacheKey, request);
  return request;
}
function normalizeDurableRunLogTailParam(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? Math.min(1e3, value) : void 0;
}
function normalizeConversationContentSearchLimit(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? Math.min(100, value) : 80;
}
var api = {
  // ── Core ──────────────────────────────────────────────────────────────────
  status: async () => get("/status"),
  daemon: async () => get("/daemon"),
  extensions: async () => extensionGet("/extensions"),
  extensionInstallations: async () => extensionGet("/extensions/installed"),
  extensionRegistry: async () => extensionGet("/extensions/registry"),
  extensionCriticalRegistry: async () => extensionGet("/extensions/registry/critical"),
  createExtension: async (input) => extensionPost("/extensions", input),
  importExtension: async (input) => extensionPost("/extensions/import", input),
  cleanRoomImport: async (input) => extensionPost("/extensions/clean-room-import", input),
  extensionRoutes: async () => extensionGet("/extensions/routes"),
  extensionSurfaces: async () => extensionGet("/extensions/surfaces"),
  extensionCommands: async () => extensionGet("/extensions/commands"),
  executeExtensionCommand: async (commandId, input) => extensionPost(
    `/extensions/commands/${encodeURIComponent(commandId)}/execute`,
    input ?? {}
  ),
  acknowledgeExtensionCommand: async (requestId, handled) => extensionPost(`/extensions/commands/acks/${encodeURIComponent(requestId)}`, { handled }),
  extensionUiConfirmations: async () => extensionGet("/extensions/ui-confirmations"),
  resolveExtensionUiConfirmation: async (requestId, status) => extensionPost(`/extensions/ui-confirmations/${encodeURIComponent(requestId)}`, { status }),
  extensionKeybindings: async () => extensionGet("/extensions/keybindings"),
  updateExtensionKeybinding: async (extensionId, keybindingId, input) => extensionPatch(`/extensions/keybindings/${encodeURIComponent(extensionId)}/${encodeURIComponent(keybindingId)}`, input),
  extensionSlashCommands: async () => extensionGet("/extensions/slash-commands"),
  extensionMentions: async () => extensionGet("/extensions/mentions"),
  extensionQuickOpen: async () => extensionGet("/extensions/quick-open"),
  extensionSearchProviders: async () => extensionGet("/extensions/search-providers"),
  extensionSearch: async (input) => extensionPost("/extensions/search", input),
  extensionManifest: async (extensionId) => extensionGet(`/extensions/${encodeURIComponent(extensionId)}/manifest`),
  extensionSurfacesForExtension: async (extensionId) => extensionGet(`/extensions/${encodeURIComponent(extensionId)}/surfaces`),
  extensionStateList: async (extensionId, prefix = "") => extensionGet(
    `/extensions/${encodeURIComponent(extensionId)}/state${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ""}`
  ),
  extensionState: async (extensionId, key) => extensionGet(
    `/extensions/${encodeURIComponent(extensionId)}/state/${encodeURIComponent(key)}`
  ),
  putExtensionState: async (extensionId, key, value, opts) => extensionPut(
    `/extensions/${encodeURIComponent(extensionId)}/state/${encodeURIComponent(key)}`,
    {
      value,
      expectedVersion: opts?.expectedVersion
    }
  ),
  deleteExtensionState: async (extensionId, key) => extensionDelete(`/extensions/${encodeURIComponent(extensionId)}/state/${encodeURIComponent(key)}`),
  startExtensionRun: async (extensionId, input) => extensionPost(`/extensions/${encodeURIComponent(extensionId)}/runs`, input),
  invokeExtensionAction: async (extensionId, actionId, input) => extensionPost(
    `/extensions/${encodeURIComponent(extensionId)}/actions/${encodeURIComponent(actionId)}`,
    input
  ),
  listExtensionActions: async () => extensionGet("/extensions/actions"),
  extensionStatus: async (extensionId) => extensionGet(`/extensions/${encodeURIComponent(extensionId)}/status`),
  extensionSelfTest: async (extensionId) => extensionPost(
    `/extensions/${encodeURIComponent(extensionId)}/self-test`
  ),
  extensionTelemetry: async (extensionId) => extensionGet(
    `/extensions/telemetry${extensionId ? `?extensionId=${encodeURIComponent(extensionId)}` : ""}`
  ),
  extensionAuditEvents: async () => extensionGet("/extensions/audit-events"),
  reloadExtensions: async () => extensionPost("/extensions/reload"),
  updateExtension: async (extensionId, input) => extensionPatch(
    `/extensions/${encodeURIComponent(extensionId)}`,
    input
  ),
  deleteExtension: async (extensionId) => extensionDelete(`/extensions/${encodeURIComponent(extensionId)}`),
  buildExtension: async (extensionId) => extensionPost(`/extensions/${encodeURIComponent(extensionId)}/build`),
  validateExtension: async (extensionId) => extensionPost(`/extensions/${encodeURIComponent(extensionId)}/validate`),
  reloadExtension: async (extensionId) => extensionPost(`/extensions/${encodeURIComponent(extensionId)}/reload`),
  snapshotExtension: async (extensionId) => extensionPost(`/extensions/${encodeURIComponent(extensionId)}/snapshot`),
  exportExtension: async (extensionId) => extensionPost(`/extensions/${encodeURIComponent(extensionId)}/export`),
  sessions: async (options) => {
    const limit = Number.isSafeInteger(options?.limit) && typeof options?.limit === "number" && options.limit > 0 ? options.limit : null;
    return get(limit === null ? "/sessions" : `/sessions?limit=${encodeURIComponent(String(limit))}`);
  },
  sessionMeta: async (id) => get(`/sessions/${encodeURIComponent(id)}/meta`),
  sessionDetail: async (id, options) => {
    const params = new URLSearchParams();
    if (options?.tailBlocks !== void 0) params.set("tailBlocks", String(options.tailBlocks));
    if (options?.includeToolBlocks === false) params.set("includeToolBlocks", "false");
    const query = params.toString();
    return get(`/sessions/${encodeURIComponent(id)}${query ? `?${query}` : ""}`);
  },
  sessionBlock: async (id, blockId) => {
    return get(`/sessions/${encodeURIComponent(id)}/blocks/${encodeURIComponent(blockId)}`);
  },
  sessionEntryBlocks: async (id, entryIds) => {
    return post(`/sessions/${encodeURIComponent(id)}/entry-blocks`, { entryIds });
  },
  sessionSearchIndex: async (sessionIds) => {
    return post("/sessions/search-index", { sessionIds });
  },
  relatedConversationResults: async (input) => post("/related-conversations/results", input),
  conversationContentSearch: async (query, limit = 80) => post("/sessions/search", { query, limit: normalizeConversationContentSearchLimit(limit) }),
  conversationSummaries: async (sessionIds, sessions) => post("/conversation-summaries", {
    sessionIds,
    ...sessions ? { sessions } : {}
  }),
  skillFolders: async () => get("/skill-folders"),
  updateSkillFolders: async (skillDirs) => patch("/skill-folders", { skillDirs }),
  instructions: async () => get("/instructions"),
  updateInstructions: async (instructionFiles) => patch("/instructions", { instructionFiles }),
  systemPromptTemplate: async () => get("/system-prompt-template"),
  updateSystemPromptTemplate: async (template) => patch("/system-prompt-template", { template }),
  // ── Models ────────────────────────────────────────────────────────────────
  models: async () => get("/models"),
  refreshModels: async () => post("/models/refresh"),
  modelPreferences: async () => get("/model-preferences"),
  modelProviders: async () => get("/model-providers"),
  testModelProvider: async (provider) => post(`/model-providers/${encodeURIComponent(provider)}/test`),
  saveModelProvider: async (provider, input) => patch(`/model-providers/${encodeURIComponent(provider)}`, input),
  deleteModelProvider: async (provider) => del(`/model-providers/${encodeURIComponent(provider)}`),
  saveModelProviderModel: async (provider, input) => patch(`/model-providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(input.modelId)}`, input),
  deleteModelProviderModel: async (provider, modelId) => del(`/model-providers/${encodeURIComponent(provider)}/models/${encodeURIComponent(modelId)}`),
  defaultCwd: async () => get("/default-cwd"),
  tools: async () => get("/tools"),
  setModel: async (model) => patch("/model-preferences", {
    model
  }),
  updateModelPreferences: async (input) => patch(
    "/model-preferences",
    input
  ),
  updateDefaultCwd: async (cwd) => patch("/default-cwd", { cwd }),
  providerAuth: async () => get("/provider-auth"),
  setProviderApiKey: async (provider, apiKey) => patch(`/provider-auth/${encodeURIComponent(provider)}/api-key`, { apiKey }),
  removeProviderCredential: async (provider) => del(`/provider-auth/${encodeURIComponent(provider)}`),
  startProviderOAuthLogin: async (provider) => post(`/provider-auth/${encodeURIComponent(provider)}/oauth`),
  providerOAuthLogin: async (loginId) => get(`/provider-auth/oauth/${encodeURIComponent(loginId)}`),
  submitProviderOAuthLoginInput: async (loginId, value) => post(`/provider-auth/oauth/${encodeURIComponent(loginId)}/input`, { value }),
  cancelProviderOAuthLogin: async (loginId) => post(`/provider-auth/oauth/${encodeURIComponent(loginId)}/cancel`),
  readConversationWorkspace: async () => get("/conversation-workspace"),
  sidebarConversations: async () => get("/sidebar/conversations"),
  saveConversationWorkspaceLayout: async (sessionIds, pinnedSessionIds, archivedSessionIds, workspacePaths, activeConversationId, options = {}) => {
    const request = {
      ...sessionIds !== void 0 ? { sessionIds } : {},
      ...pinnedSessionIds !== void 0 ? { pinnedSessionIds } : {},
      ...archivedSessionIds !== void 0 ? { archivedSessionIds } : {},
      ...options.lockedConversationIds !== void 0 ? { lockedConversationIds: options.lockedConversationIds } : {},
      ...options.remoteControlledConversationIds !== void 0 ? { remoteControlledConversationIds: options.remoteControlledConversationIds } : {},
      ...workspacePaths !== void 0 ? { workspacePaths } : {},
      ...activeConversationId !== void 0 ? { activeConversationId } : {},
      ...options.conversationWorkspaceMigrated !== void 0 ? { conversationWorkspaceMigrated: options.conversationWorkspaceMigrated } : {}
    };
    return patch("/conversation-workspace", request);
  },
  updateConversationWorkspace: async (input) => post("/conversation-workspace/operation", input),
  savedWorkspacePaths: async () => {
    const { workspacePaths } = await api.sidebarConversations();
    return workspacePaths;
  },
  setSavedWorkspacePaths: async (workspacePaths) => {
    const { workspacePaths: savedPaths } = await api.saveConversationWorkspaceLayout(void 0, void 0, void 0, workspacePaths);
    return savedPaths;
  },
  // ── Conversation Activity ─────────────────────────────────────────────────
  conversationConnections: async (id, options = {}) => {
    const params = new URLSearchParams();
    if (options.active !== void 0) params.set("active", String(options.active));
    if (options.kind) params.set("kind", options.kind);
    if (options.surface) params.set("surface", options.surface);
    if (options.visibility) params.set("visibility", options.visibility);
    const query = params.toString();
    return get(`/conversations/${encodeURIComponent(id)}/connections${query ? `?${query}` : ""}`);
  },
  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: async () => get("/tasks"),
  taskDetail: async (id) => get(`/tasks/${encodeURIComponent(id)}`),
  taskSchedulerHealth: async () => get("/tasks/scheduler/health"),
  createTask: async (input) => {
    return post("/tasks", input);
  },
  setTaskEnabled: async (id, enabled) => {
    return patch(`/tasks/${encodeURIComponent(id)}`, { enabled });
  },
  saveTask: async (id, input) => {
    return patch(`/tasks/${encodeURIComponent(id)}`, input);
  },
  taskLog: async (id) => {
    return get(`/tasks/${encodeURIComponent(id)}/log`);
  },
  deleteTask: async (id) => {
    return del(`/tasks/${encodeURIComponent(id)}`);
  },
  runTaskNow: async (id) => {
    return post(`/tasks/${encodeURIComponent(id)}/run`);
  },
  automations: {
    list: () => api.tasks(),
    get: (taskId) => api.taskDetail(taskId),
    create: (input) => api.createTask(input),
    update: (taskId, input) => api.saveTask(taskId, input),
    delete: (taskId) => api.deleteTask(taskId),
    run: (taskId) => api.runTaskNow(taskId),
    readLog: (taskId) => api.taskLog(taskId),
    readSchedulerHealth: () => api.taskSchedulerHealth()
  },
  runs: async () => get("/runs"),
  durableRun: async (id) => get(`/runs/${encodeURIComponent(id)}`),
  durableRunLog: async (id, tail) => {
    const normalizedTail = normalizeDurableRunLogTailParam(tail);
    return get(
      `/runs/${encodeURIComponent(id)}/log${normalizedTail ? `?tail=${encodeURIComponent(String(normalizedTail))}` : ""}`
    );
  },
  markDurableRunAttentionRead: async (id, read = true) => {
    return post(`/runs/${encodeURIComponent(id)}/attention`, { read });
  },
  cancelDurableRun: async (id) => {
    return post(`/runs/${encodeURIComponent(id)}/cancel`);
  },
  executions: async () => get("/executions"),
  conversationExecutions: async (conversationId, options = {}) => {
    const params = new URLSearchParams();
    if (options.active !== void 0) params.set("active", String(options.active));
    if (options.visibility) params.set("visibility", options.visibility);
    const query = params.toString();
    return get(
      `/conversations/${encodeURIComponent(conversationId)}/executions${query ? `?${query}` : ""}`
    );
  },
  execution: async (id) => get(`/executions/${encodeURIComponent(id)}`),
  executionLog: async (id, tail) => {
    const normalizedTail = normalizeDurableRunLogTailParam(tail);
    return get(
      `/executions/${encodeURIComponent(id)}/log${normalizedTail ? `?tail=${encodeURIComponent(String(normalizedTail))}` : ""}`
    );
  },
  cancelExecution: async (id) => post(`/executions/${encodeURIComponent(id)}/cancel`),
  rerunExecution: async (id) => post(`/executions/${encodeURIComponent(id)}/rerun`),
  followUpExecution: async (id, prompt) => post(
    `/executions/${encodeURIComponent(id)}/follow-up`,
    prompt ? { prompt } : {}
  ),
  // ── Workspace helpers ────────────────────────────────────────────────────
  pickFolder: async (input) => {
    const request = typeof input === "string" ? { cwd: input } : {
      ...input?.cwd !== void 0 ? { cwd: input.cwd } : {},
      ...typeof input?.prompt === "string" && input.prompt.trim().length > 0 ? { prompt: input.prompt.trim() } : {}
    };
    return (await requireDesktopBridge("Picking folders")).pickFolder(request);
  },
  pickFiles: async (cwd) => post("/file-picker", cwd !== void 0 ? { cwd } : {}),
  // ── Knowledge browser ─────────────────────────────────────────────────────
  memory: () => getMemoryData(),
  markConversationAttentionRead: async (id, read = true) => {
    return post(`/conversations/${encodeURIComponent(id)}/attention`, { read });
  },
  // ── Live sessions ─────────────────────────────────────────────────────────
  liveSession: async (id) => get(`/live-sessions/${encodeURIComponent(id)}`),
  liveSessionContext: async (id) => get(`/live-sessions/${encodeURIComponent(id)}/context`),
  workspaceTree: async (cwd, path = "") => {
    const params = new URLSearchParams({ cwd });
    if (path) params.set("path", path);
    return get(`/workspace/tree?${params.toString()}`);
  },
  workspaceFile: async (cwd, path, options) => {
    const params = new URLSearchParams({ cwd, path });
    if (options?.force) params.set("force", "1");
    return get(`/workspace/file?${params.toString()}`);
  },
  resolveWorkspacePathLinks: async (cwd, targets) => post("/workspace/path-links/resolve", { cwd, targets }),
  workspaceDiff: async (cwd, path) => {
    const params = new URLSearchParams({ cwd, path });
    return get(`/workspace/diff?${params.toString()}`);
  },
  workspaceUncommittedDiff: async (cwd) => {
    return get(`/workspace/uncommitted-diff?cwd=${encodeURIComponent(cwd)}`);
  },
  writeWorkspaceFile: async (cwd, path, content) => put("/workspace/file", { cwd, path, content }),
  createWorkspaceFile: async (cwd, path, content = "") => put("/workspace/file", { cwd, path, content, overwrite: false }),
  createWorkspaceFolder: async (cwd, path) => post("/workspace/folder", { cwd, path }),
  deleteWorkspacePath: async (cwd, path) => {
    const params = new URLSearchParams({ cwd, path });
    return del(`/workspace/path?${params.toString()}`);
  },
  renameWorkspacePath: async (cwd, path, newName) => post("/workspace/rename", { cwd, path, newName }),
  moveWorkspacePath: async (cwd, path, targetDir) => post("/workspace/move", { cwd, path, targetDir }),
  conversationAggregate: async (id, options) => {
    const startedAtMs = performance.now();
    const params = new URLSearchParams();
    if (options?.tailBlocks !== void 0) params.set("tailBlocks", String(options.tailBlocks));
    if (options?.includeToolBlocks === false) params.set("includeToolBlocks", "false");
    const query = params.toString();
    const result = await get(`/conversations/${encodeURIComponent(id)}/aggregate${query ? `?${query}` : ""}`);
    recordClientPerfTiming({
      name: "desktop.conversationAggregate",
      startedAtMs,
      meta: {
        conversationId: id,
        tailBlocks: options?.tailBlocks,
        serverPerf: result.conversation.perf
      }
    });
    return result;
  },
  conversationAggregateDeltas: async (id, options) => {
    const params = new URLSearchParams({ after: String(options.afterRevision) });
    if (options.limit !== void 0) params.set("limit", String(options.limit));
    return get(`/conversations/${encodeURIComponent(id)}/aggregate/deltas?${params.toString()}`);
  },
  conversationPlansWorkspace: async () => get("/conversation-plans/workspace"),
  conversationArtifacts: async (id) => get(`/conversations/${encodeURIComponent(id)}/artifacts`),
  conversationArtifact: async (id, artifactId) => {
    return get(
      `/conversations/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(artifactId)}`
    );
  },
  deleteConversationArtifact: async (id, artifactId) => {
    return del(
      `/conversations/${encodeURIComponent(id)}/artifacts/${encodeURIComponent(artifactId)}`
    );
  },
  conversationCheckpoints: async (id) => get(
    `/conversations/${encodeURIComponent(id)}/checkpoints`
  ),
  conversationCheckpoint: async (id, checkpointId) => {
    return get(
      `/conversations/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}`
    );
  },
  conversationCheckpointReviewContext: async (id, checkpointId) => {
    return get(
      `/conversations/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}/review-context`
    );
  },
  createConversationCheckpointComment: async (id, checkpointId, input) => {
    return post(
      `/conversations/${encodeURIComponent(id)}/checkpoints/${encodeURIComponent(checkpointId)}/comments`,
      input
    );
  },
  conversationContextDocs: async (id) => {
    return get(
      `/conversations/${encodeURIComponent(id)}/context-docs`
    );
  },
  updateConversationContextDocs: async (id, docs) => {
    return patch(
      `/conversations/${encodeURIComponent(id)}/context-docs`,
      { docs }
    );
  },
  conversationAttachments: async (id) => get(`/conversations/${encodeURIComponent(id)}/attachments`),
  conversationAttachment: async (id, attachmentId) => {
    return get(
      `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`
    );
  },
  conversationAttachmentAsset: async (id, attachmentId, asset, revision) => {
    const params = new URLSearchParams({ asset });
    if (revision !== void 0) params.set("revision", String(revision));
    return get(
      `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}/asset?${params.toString()}`
    );
  },
  createConversationAttachment: async (id, input) => {
    return post(
      `/conversations/${encodeURIComponent(id)}/attachments`,
      input
    );
  },
  updateConversationAttachment: async (id, attachmentId, input) => {
    return patch(
      `/conversations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
      input
    );
  },
  deferredResumes: async (id) => get(`/conversations/${encodeURIComponent(id)}/deferred-resumes`),
  scheduleDeferredResume: async (id, input) => {
    return post(
      `/conversations/${encodeURIComponent(id)}/deferred-resumes`,
      input
    );
  },
  fireDeferredResumeNow: async (id, resumeId) => {
    return post(
      `/conversations/${encodeURIComponent(id)}/deferred-resumes/${encodeURIComponent(resumeId)}/fire`
    );
  },
  cancelDeferredResume: async (id, resumeId) => {
    return del(
      `/conversations/${encodeURIComponent(id)}/deferred-resumes/${encodeURIComponent(resumeId)}`
    );
  },
  changeConversationCwd: async (id, cwd, surfaceId, workspaceCwd) => {
    return patch(`/conversations/${encodeURIComponent(id)}/cwd`, {
      cwd,
      ...workspaceCwd !== void 0 ? { workspaceCwd } : {},
      ...surfaceId ? { surfaceId } : {}
    });
  },
  duplicateConversation: async (id) => {
    return requestJson("POST", `/conversations/${encodeURIComponent(id)}/duplicate`);
  },
  renameConversation: async (id, name, surfaceId) => {
    return patch(`/conversations/${encodeURIComponent(id)}/title`, {
      name,
      ...surfaceId ? { surfaceId } : {}
    });
  },
  updateGoal: async (id, input) => {
    return patch(`/conversations/${encodeURIComponent(id)}/goal`, input);
  },
  conversationModelPreferences: async (id) => get(`/conversations/${encodeURIComponent(id)}/model-preferences`),
  updateConversationModelPreferences: async (id, input, surfaceId) => {
    return patch(`/conversations/${encodeURIComponent(id)}/model-preferences`, {
      ...input,
      ...surfaceId ? { surfaceId } : {}
    });
  },
  resumeConversation: async (id) => {
    const startedAtMs = performance.now();
    const result = await post(`/conversations/${encodeURIComponent(id)}/resume`);
    recordClientPerfTiming({
      name: "desktop.resumeConversation",
      startedAtMs,
      meta: { conversationId: id, resumedConversationId: result.conversationId, serverPerf: result.perf ?? null }
    });
    return {
      conversationId: result.conversationId,
      live: result.live,
      resumed: result.recovered,
      replayedPendingOperation: result.replayedPendingOperation,
      usedFallbackPrompt: result.usedFallbackPrompt,
      perf: result.perf
    };
  },
  prewarmLiveSession: async (cwd) => post("/live-sessions/prewarm", { cwd }),
  createLiveSession: async (cwd, text, options) => {
    const startedAtMs = performance.now();
    const result = await post("/live-sessions", {
      cwd,
      ...options?.workspaceCwd !== void 0 ? { workspaceCwd: options.workspaceCwd } : {},
      ...options?.model !== void 0 ? { model: options.model } : {},
      ...options?.thinkingLevel !== void 0 ? { thinkingLevel: options.thinkingLevel } : {},
      ...options?.serviceTier !== void 0 ? { serviceTier: options.serviceTier } : {},
      ...text !== void 0 ? { prompt: text } : {},
      ...options?.behavior !== void 0 ? { behavior: options.behavior } : {},
      ...options?.images !== void 0 ? { images: options.images } : {},
      ...options?.videos !== void 0 ? { videos: options.videos } : {},
      ...options?.attachmentRefs !== void 0 ? { attachmentRefs: options.attachmentRefs } : {},
      ...options?.contextMessages !== void 0 ? { contextMessages: options.contextMessages } : {},
      ...options?.relatedConversationIds !== void 0 ? { relatedConversationIds: options.relatedConversationIds } : {},
      ...options?.allowedToolNames !== void 0 ? { allowedToolNames: options.allowedToolNames } : {},
      ...options?.reservedSessionFile !== void 0 ? { reservedSessionFile: options.reservedSessionFile } : {}
    });
    recordClientPerfTiming({
      name: "desktop.createLiveSession",
      startedAtMs,
      meta: { hasPrompt: Boolean(text?.trim()), hasCwd: Boolean(cwd?.trim()), serverPerf: result.perf ?? null }
    });
    return result;
  },
  reserveConversation: async (cwd) => {
    const startedAtMs = performance.now();
    const result = await post("/conversations/reserve", {
      cwd
    });
    recordClientPerfTiming({
      name: "desktop.reserveConversation",
      startedAtMs,
      meta: { conversationId: result.id, hasCwd: Boolean(cwd?.trim()), serverPerf: result.perf ?? null }
    });
    return result;
  },
  resumeSession: async (sessionFile, cwd) => {
    return post("/live-sessions/resume", { sessionFile, ...cwd ? { cwd } : {} });
  },
  promptSession: async (id, text, behavior, images, videos, attachmentRefs, surfaceId, contextMessages, relatedConversationIds) => {
    const startedAtMs = performance.now();
    const result = await post(`/live-sessions/${encodeURIComponent(id)}/prompt`, {
      text,
      behavior,
      ...surfaceId ? { surfaceId } : {},
      images,
      videos,
      attachmentRefs,
      contextMessages,
      relatedConversationIds
    });
    recordClientPerfTiming({
      name: "desktop.promptSession",
      startedAtMs,
      meta: {
        conversationId: id,
        promptLength: text.length,
        imageCount: images?.length ?? 0,
        videoCount: videos?.length ?? 0,
        contextMessageCount: contextMessages?.length ?? 0,
        relatedConversationCount: relatedConversationIds?.length ?? 0,
        serverPerf: result.perf ?? null
      }
    });
    return result;
  },
  sendConversationMessage: async (id, text, behavior, images, videos, attachmentRefs, surfaceId, contextMessages, relatedConversationIds) => {
    const startedAtMs = performance.now();
    const result = await post(`/conversations/${encodeURIComponent(id)}/messages`, {
      text,
      behavior,
      ...surfaceId ? { surfaceId } : {},
      images,
      videos,
      attachmentRefs,
      contextMessages,
      relatedConversationIds
    });
    recordClientPerfTiming({
      name: "desktop.sendConversationMessage",
      startedAtMs,
      meta: {
        conversationId: id,
        promptLength: text.length,
        imageCount: images?.length ?? 0,
        videoCount: videos?.length ?? 0,
        contextMessageCount: contextMessages?.length ?? 0,
        relatedConversationCount: relatedConversationIds?.length ?? 0,
        serverPerf: result.perf ?? null
      }
    });
    return result;
  },
  restoreQueuedMessage: async (id, input, surfaceId) => {
    return post(
      `/live-sessions/${encodeURIComponent(id)}/restore-queued-message`,
      {
        behavior: input.behavior,
        index: input.index,
        ...input.previewId ? { previewId: input.previewId } : {}
      }
    );
  },
  clearQueuedMessages: async (id, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/clear-queued-messages`);
  },
  takeoverLiveSession: async (id, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/take-over`, { surfaceId });
  },
  compactSession: async (id, customInstructions, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/compact`, { customInstructions });
  },
  exportSession: async (id, outputPath) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/export`, { outputPath });
  },
  reloadSession: async (id, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/reload`);
  },
  abortSession: async (id, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/abort`);
  },
  destroySession: async (id, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/destroy`);
  },
  forkEntries: async (id) => get(`/live-sessions/${encodeURIComponent(id)}/fork-entries`),
  branchSession: async (id, entryId, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/branch`, {
      entryId,
      ...surfaceId ? { surfaceId } : {}
    });
  },
  forkSession: async (id, entryId, options, surfaceId) => {
    return post(`/live-sessions/${encodeURIComponent(id)}/fork`, {
      entryId,
      preserveSource: options?.preserveSource,
      beforeEntry: options?.beforeEntry,
      branchKind: options?.branchKind,
      ...surfaceId ? { surfaceId } : {}
    });
  },
  executeLiveSessionBash: async (id, command, options) => post(`/live-sessions/${encodeURIComponent(id)}/execute-bash`, {
    command,
    excludeFromContext: options?.excludeFromContext
  }),
  gateways: async () => get("/gateways"),
  ensureGatewayConnection: async (provider) => post("/gateways/connections", { provider }),
  updateGatewayConnection: async (provider, input) => patch(`/gateways/connections/${encodeURIComponent(provider)}`, input),
  attachGatewayConversation: async (input) => post("/gateways/bindings", input),
  detachGatewayConversation: async (conversationId, provider) => del(
    `/gateways/bindings/${encodeURIComponent(conversationId)}${provider ? `?provider=${encodeURIComponent(provider)}` : ""}`
  ),
  telegramGatewayToken: async () => get("/gateways/telegram/token"),
  saveTelegramGatewayToken: async (token) => post("/gateways/telegram/token", { token }),
  deleteTelegramGatewayToken: async () => del("/gateways/telegram/token"),
  saveTelegramGatewayChat: async (chatId) => post("/gateways/telegram/chat", { chatId }),
  // ── Traces ────────────────────────────────────────────────────────────
  tracesSummary: (range) => get(`/traces/summary${range ? `?range=${range}` : ""}`),
  tracesModelUsage: (range) => get(`/traces/model-usage${range ? `?range=${range}` : ""}`),
  tracesCostByConversation: (range) => get(`/traces/cost-by-conversation${range ? `?range=${range}` : ""}`),
  tracesToolHealth: (range) => get(`/traces/tool-health${range ? `?range=${range}` : ""}`),
  tracesContext: (range) => get(`/traces/context${range ? `?range=${range}` : ""}`),
  tracesAgentLoop: (range) => get(`/traces/agent-loop${range ? `?range=${range}` : ""}`),
  tracesTokensDaily: (range) => get(`/traces/tokens-daily${range ? `?range=${range}` : ""}`),
  tracesToolFlow: (range) => get(`/traces/tool-flow${range ? `?range=${range}` : ""}`),
  tracesAutoMode: (range) => get(`/traces/auto-mode${range ? `?range=${range}` : ""}`),
  tracesCacheEfficiency: (range) => get(
    `/traces/cache-efficiency${range ? `?range=${range}` : ""}`
  ),
  tracesSystemPrompt: (range) => get(`/traces/system-prompt${range ? `?range=${range}` : ""}`),
  tracesContextPointers: (range) => get(`/traces/context-pointers${range ? `?range=${range}` : ""}`),
  tracesSessionIntegrity: (range) => get(`/traces/session-integrity${range ? `?range=${range}` : ""}`),
  telemetryLogs: () => get("/telemetry/logs"),
  exportTelemetryLogs: (input) => post("/telemetry/logs/export", input ?? {}),
  maintainTelemetryDb: () => post("/telemetry/db/maintenance"),
  // ── Unified settings store ──────────────────────────────────────
  settings: async () => get("/settings"),
  settingsSchema: async () => get("/settings/schema"),
  updateSettings: async (overrides) => patch("/settings", overrides),
  // ── Secrets ─────────────────────────────────────────────────────
  secrets: async () => get("/secrets"),
  setSecret: async (extensionId, secretId, value) => put(`/secrets/${encodeURIComponent(extensionId)}/${encodeURIComponent(secretId)}`, { value }),
  deleteSecret: async (extensionId, secretId) => del(`/secrets/${encodeURIComponent(extensionId)}/${encodeURIComponent(secretId)}`),
  // ── Setup readiness ─────────────────────────────────────────────
  setupReadiness: async () => get("/setup/readiness"),
  runSetupReadinessAction: async (extensionId, itemId, actionId) => post(
    `/setup/readiness/items/${encodeURIComponent(extensionId)}/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(actionId)}`
  ),
  dismissSetupReadinessItem: async (extensionId, itemId) => post(`/setup/readiness/items/${encodeURIComponent(extensionId)}/${encodeURIComponent(itemId)}/dismiss`),
  restoreSetupReadinessItem: async (extensionId, itemId) => post(`/setup/readiness/items/${encodeURIComponent(extensionId)}/${encodeURIComponent(itemId)}/restore`)
};

// packages/desktop/ui/src/app/contexts.ts
init_neon_pilot_shared_react();

// packages/desktop/ui/src/conversation/conversationEventVersions.ts
var INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS = /* @__PURE__ */ new Map();

// packages/desktop/ui/src/app/contexts.ts
var LiveTitlesContext = createContext({
  titles: /* @__PURE__ */ new Map(),
  setTitle: () => {
  }
});
var INITIAL_APP_EVENT_VERSIONS = {
  sessions: 0,
  sessionFiles: 0,
  artifacts: 0,
  checkpoints: 0,
  attachments: 0,
  extensions: 0,
  tasks: 0,
  models: 0,
  gateways: 0,
  runs: 0,
  executions: 0,
  automation: 0,
  routines: 0,
  daemon: 0,
  workspace: 0,
  knowledgeBase: 0,
  readiness: 0
};
var AppEventsContext = createContext({
  versions: INITIAL_APP_EVENT_VERSIONS,
  conversationVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS,
  conversationMetadataVersions: INITIAL_CONVERSATION_SCOPED_EVENT_VERSIONS
});
function useAppEvents() {
  return useContext(AppEventsContext);
}
var SseConnectionContext = createContext({
  status: "connecting"
});
var AppDataContext = createContext({
  projects: null,
  setProjects: () => {
  }
});
var SystemStatusContext = createContext({
  daemon: null,
  setDaemon: () => {
  }
});

// packages/desktop/ui/src/components/notifications/notificationStore.tsx
init_neon_pilot_shared_react();
var nextId = 1;
function generateId() {
  return `notif-${nextId++}-${Date.now()}`;
}
var NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  add: () => "",
  dismiss: () => {
  },
  dismissAll: () => {
  },
  markRead: () => {
  },
  markAllRead: () => {
  }
});
var externalAdd = null;
var preMountBuffer = [];
function addNotification(payload) {
  if (externalAdd) {
    return externalAdd(payload);
  }
  preMountBuffer.push(payload);
  return generateId();
}

// packages/desktop/ui/src/hooks/useApi.ts
init_neon_pilot_shared_react();
function useApi(fetcher, key, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcher);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const dataRef = useRef(null);
  const notifyOnErrorRef = useRef(options.notifyOnError ?? true);
  fetcherRef.current = fetcher;
  dataRef.current = data;
  notifyOnErrorRef.current = options.notifyOnError ?? true;
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const runFetch = useCallback(async (options2) => {
    const requestId = ++requestIdRef.current;
    const hasData = dataRef.current !== null;
    const resetLoading = options2?.resetLoading ?? !hasData;
    if (resetLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    if (!hasData || resetLoading) {
      setError(null);
    }
    try {
      const result = await fetcherRef.current();
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }
      dataRef.current = result;
      setData(result);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return result;
    } catch (err) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return null;
      }
      const message = err instanceof Error ? err.message : String(err);
      if (!hasData || resetLoading) {
        setError(message);
        if (notifyOnErrorRef.current) {
          addNotification({ type: "error", message, details: err instanceof Error ? err.stack : void 0, source: "core" });
        }
      }
      setLoading(false);
      setRefreshing(false);
      return null;
    }
  }, []);
  const replaceData = useCallback((nextData) => {
    requestIdRef.current += 1;
    dataRef.current = nextData;
    setData(nextData);
    setLoading(false);
    setRefreshing(false);
    setError(null);
  }, []);
  useEffect(() => {
    dataRef.current = null;
    setData(null);
    setError(null);
    void runFetch({ resetLoading: true });
  }, [key, runFetch]);
  return { data, loading, refreshing, error, refetch: runFetch, replaceData };
}

// packages/desktop/ui/src/desktop/clipboard.ts
async function writeClipboardText(text) {
  const desktopClipboard = window.neonPilotDesktop?.writeClipboardText;
  if (desktopClipboard) {
    const result = await desktopClipboard(text);
    if (!result.ok) {
      throw new Error(result.error || "Copy to clipboard failed.");
    }
    return;
  }
  if (typeof navigator === "undefined" || typeof navigator.clipboard?.writeText !== "function") {
    throw new Error("Clipboard access is unavailable.");
  }
  await navigator.clipboard.writeText(text);
}

export {
  recordChatRenderTiming,
  measureClientPerfTiming,
  recordExtensionRegistryUsability,
  recordActivityTreeRowRender,
  buildApiPath,
  DESKTOP_WORKBENCH_BROWSER_COMMENT_EVENT,
  getDesktopBridge,
  api,
  useAppEvents,
  addNotification,
  useApi,
  writeClipboardText
};
