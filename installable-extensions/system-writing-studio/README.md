# Writing Studio

Writing Studio is an optional installable extension for document-first collaborative writing. It provides a markdown editor, CRDT-backed document persistence, replayable event history, anchored agent annotations, lightweight reactions, suggestions, and a secondary chat panel.

The document is the primary workspace. Chat stays in a narrow rail and agent feedback is written as structured annotations over the current document text.

## Runtime model

- The frontend uses Tiptap for the editing surface.
- A Yjs `Y.Text` named `markdown` is the canonical CRDT document.
- Every local document change is encoded as a Yjs update and appended to backend storage.
- Backend storage keeps an append-only event log plus periodic latest-state metadata.
- Replay reconstructs document state by applying stored Yjs update events in order and then layering annotations and settings events.
- Chat is hosted by a first-class live conversation created through the extension backend context and rendered with the shared `ExtensionChatRail` UI primitive. Writing Studio injects document context into sends, but streaming, model selection, aborts, and transcript rendering use the same host conversation path as the main chat surfaces.

## Actions

- `writingStudioLoad` loads the latest snapshot and replay log.
- `writingStudioAppendUpdate` appends a base64 Yjs update.
- `writingStudioReplayDocument` reconstructs the markdown from the replay log and reports whether it matches the latest stored state.
- `writingStudioRunReview` adds structured commentary, suggestion, or reaction annotations for the latest text.
- `writingStudioReviewSelection` reviews only the selected passage and anchors comments to that selected text.
- `writingStudioEnsureChatSession` creates or verifies the hosted live conversation used by the shared chat rail.
- `writingStudioClearChat` aborts the current hosted chat conversation and starts a fresh one.
- `writingStudioResolveAnnotation` marks an annotation resolved.
