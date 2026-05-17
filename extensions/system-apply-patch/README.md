# Apply Patch

Adds an `apply_patch` agent tool for Codex-style file patches and an OpenAI-only patch-based replacement for `edit`.

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
