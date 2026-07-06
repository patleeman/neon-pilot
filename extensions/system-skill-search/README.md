# Skill Search

Searches upstream skill repositories, previews fetched skills through a quarantine and vetting flow, and installs vetted skills into extension-owned storage. Trusted sources install directly after vetting. Community sources require a host-owned timed approval in the conversation composer area.

## Agent tools

| Tool            | Purpose                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `skill_browse`  | Browse upstream sources by source/query for raw inventory without invoking the ranking reviewer.             |
| `skill_search`  | Search upstream catalogs and repositories, then return a ranked shortlist from a no-tool discovery reviewer. |
| `skill_preview` | Fetch a candidate into quarantine, run deterministic checks, and run a no-tool model review.                 |
| `skill_install` | Install a chosen candidate id, then vet, approve when required, and save.                                    |

`system-skill-search` is an agent-internal service, not a user-facing marketplace. Agents search, preview, and install skills through its tools and slash commands, while enablement state is managed through Prompt Assembly.

`browseSkills` caches inventory per source, query, and limit for about a day by default. An agent call returns cached results immediately when available; stale cache entries refresh in the background. Passing `refresh: "force"` bypasses the cache for explicit refresh actions.

For agent task execution, agents should not show users a list of candidates or ask them which skill to install. The intended agent flow is:

1. Search for the needed capability.
2. Read the returned shortlist and choose the best fit as the agent.
3. Call `skill_install` with the chosen `candidateId`.
4. Let `skill_install` handle authoritative re-fetching, vetting, trusted-source installation, and community approval.

`skill_search` runs the discovery review through a no-tools agent task. That reviewer receives only host-fetched upstream previews and metadata; it cannot run bash, read the local filesystem, write files, inspect secrets, or call general tools. `skill_install` does not accept a query or approval flag. Community candidates trigger the host approval shelf after vetting passes; declined or timed-out approvals cancel installation.

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
pnpm exec vitest run extensions/system-skill-search/src/backend.test.ts extensions/system-skill-search/src/manifest.test.ts
pnpm run extension:build -- extensions/system-skill-search
```
