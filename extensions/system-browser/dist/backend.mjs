import { createRequire as __paExtensionCreateRequire } from "node:module"; const require = __paExtensionCreateRequire(import.meta.url);

// packages/desktop/server/extensions/backendApi/browser.ts
var EXTENSION_HOST_CAPABILITY_BRIDGE = Symbol.for("neon-pilot.extensionHostCapabilityBridge");
var WORKBENCH_BROWSER_TOOL_HOST_KEY = Symbol.for("neon-pilot.workbenchBrowserToolHost");
var WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY = Symbol.for("neon-pilot.workbenchBrowserNativeBridgeAttempted");
var NATIVE_REQUEST_TIMEOUT_MS = 3e4;
function workerBridge() {
  return globalThis[EXTENSION_HOST_CAPABILITY_BRIDGE];
}
function inProcessWorkbenchBrowserToolHost() {
  const hostGlobal = globalThis;
  const existing = hostGlobal[WORKBENCH_BROWSER_TOOL_HOST_KEY];
  if (existing !== void 0) return existing;
  const nativeBridge = createNativeProcessWorkbenchBrowserBridge();
  hostGlobal[WORKBENCH_BROWSER_TOOL_HOST_KEY] = nativeBridge;
  return nativeBridge;
}
function createNativeProcessWorkbenchBrowserBridge() {
  const hostGlobal = globalThis;
  if (hostGlobal[WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY]) return null;
  hostGlobal[WORKBENCH_BROWSER_NATIVE_BRIDGE_ATTEMPTED_KEY] = true;
  if (typeof process === "undefined" || typeof process.send !== "function") return null;
  const proc = process;
  if (typeof proc.send !== "function") return null;
  const pendingRequests = /* @__PURE__ */ new Map();
  let nextRequestId = 0;
  proc.on?.("message", (message) => {
    if (!message || typeof message !== "object") return;
    if (message.type !== "native-workbench-browser-response") return;
    const response = message;
    const pending = pendingRequests.get(response.id);
    if (!pending) return;
    pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(response.error ?? "Workbench Browser native bridge failed."));
  });
  function sendRequest(method, args) {
    const id = String(++nextRequestId);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Workbench Browser native bridge timed out for ${method}.`));
      }, NATIVE_REQUEST_TIMEOUT_MS);
      timeout.unref?.();
      pendingRequests.set(id, { resolve, reject, timeout });
      try {
        const sent = proc.send?.({
          type: "native-workbench-browser-request",
          id,
          method,
          args
        }) ?? false;
        if (!sent) {
          pendingRequests.delete(id);
          clearTimeout(timeout);
          reject(new Error("Workbench Browser native bridge send failed: parent process unavailable."));
        }
      } catch (error) {
        pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
  return {
    isActive: (conversationId) => sendRequest("isActive", [conversationId]),
    listTabs: () => sendRequest("listTabs", []),
    snapshot: (conversationId, tabId) => sendRequest("snapshot", [conversationId, tabId]),
    screenshot: (conversationId, tabId) => sendRequest("screenshot", [conversationId, tabId]),
    cdp: (input) => sendRequest("cdp", [input])
  };
}
function createWorkerWorkbenchBrowserToolHost(bridge) {
  return {
    isActive: (conversationId) => bridge("browser", "isActive", { conversationId }),
    listTabs: () => bridge("browser", "listTabs", {}),
    snapshot: (conversationId, tabId) => bridge("browser", "snapshot", { conversationId, ...tabId ? { tabId } : {} }),
    screenshot: (conversationId, tabId) => bridge("browser", "screenshot", { conversationId, ...tabId ? { tabId } : {} }),
    cdp: (input) => bridge("browser", "cdp", input)
  };
}
function getWorkbenchBrowserToolHost() {
  const bridge = workerBridge();
  if (bridge) return createWorkerWorkbenchBrowserToolHost(bridge);
  return inProcessWorkbenchBrowserToolHost();
}

// extensions/system-browser/src/backend.ts
function requireHost() {
  const host = getWorkbenchBrowserToolHost();
  if (!host) {
    throw new Error("Workbench Browser tools are only available in the desktop app.");
  }
  return host;
}
async function requireActiveHost(conversationId, signal) {
  const host = requireHost();
  const active = await withBrowserToolDeadline("Browser active check", signal, host.isActive(conversationId));
  if (!active) {
    throw new Error("Workbench Browser is not active for this conversation. Open the Browser workbench panel before using browser tools.");
  }
  return host;
}
var BROWSER_TOOL_TIMEOUT_MS = 1e4;
var BrowserToolAbortError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "BrowserToolAbortError";
  }
};
function tabIdFromSessionKey(sessionKey) {
  const prefix = "@global:tab-";
  return sessionKey.startsWith(prefix) ? sessionKey.slice(prefix.length) : sessionKey;
}
function normalizeScreenshotImage(screenshot) {
  const data = typeof screenshot.dataBase64 === "string" ? screenshot.dataBase64.trim() : "";
  const mimeType = typeof screenshot.mimeType === "string" ? screenshot.mimeType.trim() : "image/png";
  if (!data || !mimeType.toLowerCase().startsWith("image/")) return void 0;
  return { data, mimeType };
}
async function withBrowserToolDeadline(label, signal, operation) {
  if (signal?.aborted) {
    throw new BrowserToolAbortError(`${label} cancelled.`);
  }
  let timeout;
  let abortHandler;
  const deadline = new Promise((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new BrowserToolAbortError(`${label} timed out after ${BROWSER_TOOL_TIMEOUT_MS / 1e3}s.`)),
      BROWSER_TOOL_TIMEOUT_MS
    );
    abortHandler = () => reject(new BrowserToolAbortError(`${label} cancelled.`));
    signal?.addEventListener("abort", abortHandler, { once: true });
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
    if (abortHandler) {
      signal?.removeEventListener("abort", abortHandler);
    }
  }
}
function formatSnapshot(snapshot, tabs, targetTabId) {
  const data = snapshot;
  const snapshotUrl = data.url ?? "";
  const lines = [
    `URL: ${snapshotUrl}`,
    `Title: ${data.title ?? ""}`,
    `Loading: ${data.loading === true ? "yes" : "no"}`,
    `Browser revision: ${data.browserRevision ?? 0}`,
    `Changed since last snapshot: ${data.changedSinceLastSnapshot === true ? "yes" : "no"}`
  ];
  if (data.lastChangeReason || data.lastChangedAt) {
    lines.push(`Last browser change: ${data.lastChangeReason ?? "unknown"}${data.lastChangedAt ? ` at ${data.lastChangedAt}` : ""}`);
  }
  if (tabs.length > 0) {
    lines.push("", `Open tabs (${tabs.length}):`);
    for (const tab of tabs) {
      const tabId = tabIdFromSessionKey(tab.sessionKey);
      const isActive = tabId === targetTabId || !targetTabId && tab.url === snapshotUrl;
      const isActiveMarker = isActive ? " (active)" : "";
      lines.push(`  tabId=${tabId} title=${JSON.stringify(tab.title)} url=${tab.url}${isActiveMarker}`);
    }
  }
  if (data.elements?.length) {
    lines.push("", "Elements:");
    for (const element of data.elements.slice(0, 120)) {
      const state = [
        element.enabled === false ? "disabled" : "enabled",
        typeof element.checked === "boolean" ? `checked=${element.checked}` : ""
      ].filter(Boolean).join(" ");
      lines.push(
        `${element.ref ?? ""} role=${element.role ?? ""} name=${JSON.stringify(element.name ?? "")} selector=${JSON.stringify(
          element.selector ?? ""
        )} ${state}`.trim()
      );
      if (element.text && element.text !== element.name) {
        lines.push(`  text=${JSON.stringify(element.text)}`);
      }
    }
  }
  if (data.text) {
    lines.push("", "Visible text:", data.text.slice(0, 2e4));
  }
  return lines.join("\n");
}
function getToolContext(ctx) {
  const conversationId = ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId ?? "";
  const signal = ctx.agentToolContext?.signal;
  return { conversationId, signal };
}
async function browserSnapshot(input, ctx) {
  const { conversationId, signal } = getToolContext(ctx);
  const tabId = input.tabId;
  try {
    const host = await requireActiveHost(conversationId, signal);
    const tabs = await withBrowserToolDeadline("Browser tab listing", signal, host.listTabs());
    const snapshot = await withBrowserToolDeadline("Browser snapshot", signal, host.snapshot(conversationId, tabId));
    return {
      content: [{ type: "text", text: formatSnapshot(snapshot, tabs, tabId) }],
      details: { snapshot, tabs }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Browser snapshot failed: ${message}` }],
      isError: true,
      details: { action: "snapshot", error: message }
    };
  }
}
async function browserCdp(input, ctx) {
  const { conversationId, signal } = getToolContext(ctx);
  const params = input;
  try {
    const host = await requireActiveHost(conversationId, signal);
    const result = await withBrowserToolDeadline(
      "Browser CDP command",
      signal,
      host.cdp({
        conversationId,
        command: params.command,
        ...params.continueOnError !== void 0 ? { continueOnError: params.continueOnError } : {},
        ...params.tabId ? { tabId: params.tabId } : {}
      })
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2).slice(0, 8e4) }],
      details: result
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: `Browser CDP command failed: ${message}. Try browser_snapshot first to check the browser state.` }
      ],
      isError: true,
      details: { action: "cdp", error: message }
    };
  }
}
async function browserScreenshot(input, ctx) {
  const { conversationId, signal } = getToolContext(ctx);
  const tabId = input.tabId;
  try {
    const host = await requireActiveHost(conversationId, signal);
    const screenshot = await withBrowserToolDeadline("Browser screenshot", signal, host.screenshot(conversationId, tabId));
    const image = normalizeScreenshotImage(screenshot);
    if (!image) {
      return {
        content: [
          {
            type: "text",
            text: "Browser screenshot failed: captured image data was empty or invalid. Try browser_snapshot first to check the browser state."
          }
        ],
        isError: true,
        details: { action: "screenshot", error: "empty_image_data" }
      };
    }
    return {
      content: [
        { type: "text", text: "Captured Workbench Browser screenshot." },
        { type: "image", data: image.data, mimeType: image.mimeType }
      ],
      details: { url: screenshot.url, title: screenshot.title, viewport: screenshot.viewport, capturedAt: screenshot.capturedAt }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: "text", text: `Browser screenshot failed: ${message}. Try browser_snapshot first to check the browser state.` }
      ],
      isError: true,
      details: { action: "screenshot", error: message }
    };
  }
}
function toBackendContext(ctx, signal) {
  const conversationId = ctx?.sessionManager?.getSessionId?.() ?? "";
  return {
    toolContext: { conversationId, sessionId: conversationId },
    agentToolContext: { signal }
  };
}
function createWorkbenchBrowserAgentExtension() {
  return (pi) => {
    pi.registerTool({
      name: "browser_snapshot",
      label: "Browser Snapshot",
      description: "Observe the built-in Workbench Browser \u2014 active tab snapshot with structured elements, plus a list of all open tabs. Use tabId to target a specific tab.",
      promptSnippet: "Use browser_snapshot to understand the shared Workbench Browser. It returns the active tab snapshot plus a list of all open tabs with their tabId values. Pass tabId to target any tab. For development validation, use the agent-browser skill/CLI through bash instead.",
      promptGuidelines: [
        "Use Workbench Browser tools only for the user's visible shared browser; start with browser_snapshot and use agent-browser CLI for autonomous dev/QA."
      ],
      parameters: { type: "object", properties: { tabId: { type: "string" } }, additionalProperties: false },
      execute: (_toolCallId, params, signal, _onUpdate, ctx) => browserSnapshot(params, toBackendContext(ctx, signal))
    });
    pi.registerTool({
      name: "browser_cdp",
      label: "Browser CDP",
      description: "Send one or more Chrome DevTools Protocol commands to the Workbench Browser. Use tabId to target a specific tab.",
      promptSnippet: "Use browser_cdp to act on the shared Workbench Browser. Pass tabId to target a specific tab (get tab IDs from browser_snapshot). For dev automation/testing, use the agent-browser skill/CLI through bash instead.",
      promptGuidelines: [
        "browser_cdp controls the shared Workbench Browser; get tabId from browser_snapshot, batch multiple CDP commands in one call, and use agent-browser CLI for dev/QA automation."
      ],
      parameters: {
        type: "object",
        properties: { command: {}, continueOnError: { type: "boolean" }, tabId: { type: "string" } },
        required: ["command"],
        additionalProperties: false
      },
      execute: (_toolCallId, params, signal, _onUpdate, ctx) => browserCdp(params, toBackendContext(ctx, signal))
    });
    pi.registerTool({
      name: "browser_screenshot",
      label: "Browser Screenshot",
      description: "Capture a PNG screenshot of the Workbench Browser. Use tabId to target a specific tab.",
      promptSnippet: "Use browser_screenshot for the shared Workbench Browser when visual communication matters. Pass tabId to target a specific tab (get tab IDs from browser_snapshot). For dev validation screenshots, use the agent-browser skill/CLI through bash.",
      promptGuidelines: [
        "browser_screenshot captures the shared Workbench Browser for user-facing visual context; use agent-browser CLI for product-under-test screenshots."
      ],
      parameters: { type: "object", properties: { tabId: { type: "string" } }, additionalProperties: false },
      execute: (_toolCallId, params, signal, _onUpdate, ctx) => browserScreenshot(params, toBackendContext(ctx, signal))
    });
  };
}
export {
  browserCdp,
  browserScreenshot,
  browserSnapshot,
  createWorkbenchBrowserAgentExtension
};
