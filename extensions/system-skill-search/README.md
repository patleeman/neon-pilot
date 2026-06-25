# Skill Search

Searches upstream skill repositories, previews fetched skills through a quarantine and vetting flow, and installs vetted skills into extension-owned storage. Trusted sources install directly after vetting. Community sources require a host-owned timed approval in the conversation composer area.

## Agent tools

| Tool            | Purpose                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------- |
| `skill_search`  | Search upstream catalogs and repositories for reusable skills.                               |
| `skill_preview` | Fetch a candidate into quarantine, run deterministic checks, and run a no-tool model review. |
| `skill_install` | Fetch, vet, approve when required, and install a candidate.                                  |

`skill_install` does not accept an approval flag. Community candidates trigger the host approval shelf after vetting passes; declined or timed-out approvals cancel installation.

## Sources

The default trusted source set is intentionally conservative:

- `openai/skills`
- `anthropics/skills`
- `huggingface/skills`
- `NVIDIA/skills`
- Hermes Skills Index entries marked `builtin` or `trusted`

Hermes Skills Index community entries are returned as community candidates and are approval-gated at install time. Community sources such as skills.sh, browse.sh, ClawHub, LobeHub, direct URLs, and arbitrary well-known endpoints are intentionally out of the default search path until they have a source policy.

## Validation

```bash
pnpm exec vitest run extensions/system-skill-search/src/backend.test.ts extensions/system-skill-search/src/frontend.test.tsx
pnpm run extension:build -- extensions/system-skill-search
```
