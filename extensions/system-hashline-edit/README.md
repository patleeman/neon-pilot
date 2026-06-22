# Hashline Edit

Hash-anchored line editing tools for Neon Pilot agents.

This extension is inspired by Hashline from [Oh My Pi](https://github.com/can1357/oh-my-pi) by Can Bölük and contributors. The implementation here is Neon-native and intentionally smaller: it supports content-hash guarded line operations over existing text files, with a paired `read_hashline` tool that mints the tags used by `hashline_edit`.

## Tools

- `read_hashline` — reads a file as `[path#TAG]` plus `LINE:TEXT` rows.
- `hashline_edit` — applies `SWAP`, `DEL`, `INS.PRE`, `INS.POST`, `INS.HEAD`, and `INS.TAIL` operations when the live file still matches the tag.

## Format

```text
[src/app.ts#A1B2]
SWAP 3.=3:
+replacement line
INS.POST 5:
+inserted line
DEL 8
```

Every successful edit returns a fresh `[path#TAG]` header and a compact numbered preview for follow-up edits. Re-read or use the returned header before another edit.

## Attribution

Concept, prompt language, and overall editing model are credited to Oh My Pi Hashline: <https://github.com/can1357/oh-my-pi/tree/main/packages/hashline>.
