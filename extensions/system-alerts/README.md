# Alerts

System extension that sends native macOS notifications and optionally plays a sound when Neon Pilot raises an active alert.

## Surfaces

- Backend subscription: `contributes.subscriptions[{ source: "alerts", pattern: "upserted" }]`
- Settings: `Settings -> Extensions -> Alerts`

## Behavior

The backend listens for `host:alerts:upserted` events. It filters alerts through extension settings, suppresses duplicate delivery for the same alert `updatedAt`, then sends:

- `ctx.notify.system(...)` for macOS Notification Center delivery
- `ctx.shell.spawn({ command: "/usr/bin/afplay" })` for the selected system sound, coalesced during alert bursts

The extension does not import core or desktop internals. Core alert producers publish through the host event bus; this extension reacts through the public subscription API.

## Settings

- Attention alerts: master on/off
- Native notification: enable or disable macOS notifications
- Sound: enable or disable sound and choose the macOS system sound
- Notify for: disruptive alerts only or all active alerts

## Validation

```bash
pnpm --dir packages/desktop exec vitest run ../../extensions/system-alerts/src/backend.test.ts --reporter=dot
pnpm run extension:build -- extensions/system-alerts
```
