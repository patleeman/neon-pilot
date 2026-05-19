# Codex Compatibility

Contributes the `codex-compatible` tool profile for GPT/Codex-style coding models and provides the `apply_patch` agent tool.

The profile exposes:

- `bash`
- `apply_patch`

It is advertised as the default profile for the `openai-codex` provider. If the profile or any requested tool is unavailable, Personal Agent falls back to the normal default tool surface.

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

## File change metadata

Successful patch/edit tool results include standard `details.fileChanges` metadata so the transcript can render the exact per-tool diff inline. Very large patches are omitted with `truncated: true` to keep transcript state sane.
