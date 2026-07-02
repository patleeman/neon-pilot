import {
  Suspense,
  init_neon_pilot_shared_react,
  jsx,
  lazy
} from "./chunks/chunk-TTFLGCWD.js";
import "./chunks/chunk-MZHE4QUL.js";

// extensions/system-browser/src/frontend.tsx
init_neon_pilot_shared_react();
var LazyBrowserTranscriptRenderer = lazy(async () => ({ default: (await import("./chunks/panels-NRQHHJP5.js")).BrowserTranscriptRenderer }));
var LazyBrowserTabsPanel = lazy(async () => ({ default: (await import("./chunks/panels-NRQHHJP5.js")).BrowserTabsPanel }));
var LazyBrowserWorkbenchPanel = lazy(async () => ({ default: (await import("./chunks/panels-NRQHHJP5.js")).BrowserWorkbenchPanel }));
var fallback = /* @__PURE__ */ jsx("div", { className: "flex h-full items-center justify-center px-4 text-[12px] text-dim", children: "Loading browser\u2026" });
function BrowserTranscriptRenderer(props) {
  return /* @__PURE__ */ jsx(Suspense, { fallback, children: /* @__PURE__ */ jsx(LazyBrowserTranscriptRenderer, { ...props }) });
}
function BrowserTabsPanel() {
  return /* @__PURE__ */ jsx(Suspense, { fallback, children: /* @__PURE__ */ jsx(LazyBrowserTabsPanel, {}) });
}
function BrowserWorkbenchPanel() {
  return /* @__PURE__ */ jsx(Suspense, { fallback, children: /* @__PURE__ */ jsx(LazyBrowserWorkbenchPanel, {}) });
}
export {
  BrowserTabsPanel,
  BrowserTranscriptRenderer,
  BrowserWorkbenchPanel
};
