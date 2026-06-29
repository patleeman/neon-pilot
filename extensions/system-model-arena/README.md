# Model Arena

Model Arena collects blind model preference data from normal Neon Pilot conversations.

It samples eligible prompt submissions after challenger models are configured, starts an isolated parallel challenger run through the host conversation boundary, renders an inline A/B transcript block, and records local Elo-style preference stats after the user votes.

## Validation

```bash
pnpm run extension:build -- extensions/system-model-arena
pnpm run check:extensions:static
pnpm --dir packages/desktop run build:ui
pnpm --dir packages/desktop run build:server
```
