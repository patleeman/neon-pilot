# Model Arena

Model Arena collects blind model preference data from normal Neon Pilot conversations.

It samples eligible prompt submissions after challenger models are configured, starts an isolated parallel challenger run through the host conversation boundary, renders an inline A/B transcript block, and records local Elo-style preference stats after the user votes.

Duels compare full agent runs in a forked child conversation. Challenger jobs are not auto-imported into the parent transcript; Model Arena captures the terminal answer or failure, clears its parallel job, and updates the inline transcript block. Votes are blind until submitted, then the block reveals which model produced each side.

The dashboard keeps local-only stats, including task-type slices and confidence labels so early ratings are not presented as settled preference data. Settings expose automatic sampling, initial and ramped sample rates, ramp-down vote count, minimum prompt length, and a deduped challenger model allowlist.

## Validation

```bash
pnpm run extension:build -- extensions/system-model-arena
pnpm exec vitest run extensions/system-model-arena/src/backend.test.ts
pnpm run check:extensions:static
pnpm --dir packages/desktop run build:ui
pnpm --dir packages/desktop run build:server
```
