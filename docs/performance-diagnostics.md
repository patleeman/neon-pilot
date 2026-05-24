# Performance diagnostics

Performance diagnostics expose lightweight renderer timing samples for debugging app jank without attaching a profiler first.

The renderer stores recent samples on `window.__NEON_PILOT_APP_PERF__`. Set `localStorage.neonPilot.debugPerf = '1'` and reload to also print samples to the console.

Conversation navigation records `conversationOpenSamples` with these phases:

- `content` — the conversation page rendered usable transcript content, empty state, or error state.
- `extensions` — the shared extension registry is ready for the conversation route.
- `rail` — the context rail completed its first paint for the conversation.

`chatRenderSamples` record ChatView commit timing plus transcript shape: message count, render item count, mounted/windowed counts, trace clusters, tool blocks, standalone tool blocks, and markdown-like user/assistant blocks.

`clientSamples` record synchronous renderer work that crosses the local diagnostic threshold, including conversation transcript merging/pruning and ChatView render-item construction. Each sample includes route, start/end performance timestamps, duration, and small shape metadata.

`longTaskSamples` record Long Task API entries and event-loop lag. Samples include recent `clientSamples` plus the latest `chatRenderSamples` entry under `meta.attribution` when available, so beachball reports can be correlated with the synchronous renderer work that ran around the block.

API samples are recorded when responses include `Server-Timing` or `X-PA-Perf` headers. Keep new diagnostics cheap and side-effect-free; this is a tripwire, not a replacement for browser profiling.

Draft send responsiveness is guarded by `scripts/perf-desktop-smoke.mjs`. The smoke records both route-level visibility (`draftSubmitVisibleMs`) and first user-prompt visibility (`draftSubmitFirstPromptVisibleMs`). First-prompt visibility is computed from renderer `chatRenderSamples` relative to the synthetic click timestamp, not from CDP text polling, so custom-protocol or debugger response delays do not hide whether the UI actually painted the submitted prompt. The smoke also fails when post-submit renderer long tasks exceed `--max-post-submit-longtask-ms`.

Live prompt submission should keep foreground work tiny. Plain sends without explicit related conversations or context messages skip prompt-context provider invocation; selected related conversations and attached context still opt into provider assembly. The `/live-sessions/:id/prompt` response includes `perf.totalBeforeReturnMs`, and normal prompt starts are accepted before agent execution is scheduled so the route/prompt paint path is not blocked by agent startup.
