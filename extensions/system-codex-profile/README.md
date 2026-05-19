# Codex Compatibility

Contributes the `codex-compatible` model profile for GPT/Codex-style coding models, provides the `apply_patch` agent tool, and owns Codex/OpenAI native Responses compaction behavior.

The model profile matches `openai-codex/*`. When the extension is enabled and a matching model is active, its agent extension switches the active tool surface to:

- `bash`
- `apply_patch`

Disabled means disabled: profile behavior does not secretly activate.

Patch format:

```diff
*** Begin Patch
*** Update File: src/app.ts
@@
-old
+new
*** Add File: notes.txt
+hello
*** Delete File: obsolete.txt
*** End Patch
```

The extension intentionally uses a JSON `{ "patch": string }` envelope because manifest-declared extension tools do not currently support FREEFORM tool inputs.

## Native compaction

The backend agent extension registers provider/request lifecycle hooks that use native Responses compaction for supported OpenAI/Codex models. This behavior used to live in `system-openai-native-compaction`; it now lives here because it is part of the Codex/OpenAI compatibility profile.

## File change metadata

Successful patch/edit tool results include standard `details.fileChanges` metadata so the transcript can render the exact per-tool diff inline. Very large patches are omitted with `truncated: true` to keep transcript state sane.
