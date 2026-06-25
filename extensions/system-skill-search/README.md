# Skill Search

Searches trusted upstream skill repositories, previews fetched skills through a quarantine and vetting flow, and installs approved skills into extension-owned storage.

## Agent tools

| Tool            | Purpose                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| `skill_search`  | Search trusted upstream catalogs and repositories for reusable skills.                       |
| `skill_preview` | Fetch a candidate into quarantine, run deterministic checks, and run a no-tool model review. |
| `skill_install` | Install a vetted candidate after explicit user approval.                                     |

`skill_install` refuses to install unless `approved: true` is supplied. The agent is expected to ask the user before passing that flag.

## Sources

The first version searches:

- `openai/skills`
- `anthropics/skills`
- `huggingface/skills`
- `NVIDIA/skills`
- Hermes Skills Index entries marked `builtin` or `trusted`

Community sources such as skills.sh, browse.sh, ClawHub, LobeHub, direct URLs, and arbitrary well-known endpoints are intentionally out of the default search path.

## Validation

```bash
pnpm exec vitest run extensions/system-skill-search/src/backend.test.ts extensions/system-skill-search/src/frontend.test.tsx
pnpm run extension:build -- extensions/system-skill-search
```
