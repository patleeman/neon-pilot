# Apply Patch

Adds an `edit` agent tool for Codex-style file patches and an OpenAI-only patch-based replacement for `edit`.

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

Successful patch/edit tool results include standard `details.fileChanges` metadata so the transcript can render the exact per-tool diff inline:

```json
{
  "fileChanges": [
    {
      "path": "src/app.ts",
      "previousPath": "src/old-app.ts",
      "status": "renamed",
      "additions": 4,
      "deletions": 2,
      "patch": "diff --git a/src/old-app.ts b/src/app.ts\n..."
    }
  ]
}
```

`patch` is the unified diff for that exact tool mutation. Very large patches are omitted with `truncated: true` to keep transcript state sane.
