# AST Grep

Structural code search for Neon Pilot agents, backed by the [`ast-grep`](https://ast-grep.github.io/) CLI (`sg`).

This extension is inspired by Oh My Pi's `ast_grep` agent tool design and prompt shape: <https://github.com/can1357/oh-my-pi>. It is implemented as a Neon-native extension and uses the external `sg` binary instead of Oh My Pi's native addon.

## Tool

- `ast_grep` — search files with syntax-aware ast-grep patterns.

Example:

```json
{ "pattern": "console.log($$$)", "paths": ["src"], "glob": "**/*.ts" }
```

## Requirements

Install ast-grep CLI:

```bash
brew install ast-grep
# or see https://ast-grep.github.io/guide/quick-start.html
```

If `sg` is missing, the tool returns a setup message instead of failing obscurely.

## Attribution

- Tool idea and agent-facing ergonomics: Oh My Pi by Can Bölük and contributors.
- Structural search engine: ast-grep project.
