# Template: settings-section

Contributes a section to the main Settings page at `/settings`. No separate route or nav entry.
Good for integration configuration, feature toggles, and preferences that belong alongside other
system settings rather than on their own page.

Derived from: `system-settings` settings contribution pattern, `system-local-models` settings section.

## Files

- `extension.json` — manifest with a `settingsSections` contribution and a backend action to save settings
- `package.json` — minimal package descriptor
- `src/frontend.tsx` — exports a settings section component rendered by the host
- `src/backend.ts` — action to load and persist settings (replace with your own store)

## Customise

1. Change `"id"` in `extension.json`.
2. Change `"component"` to match your exported component name.
3. Add/remove form fields in `src/frontend.tsx`.
4. Replace the in-memory store in `src/backend.ts` with your persistence layer (e.g. `ctx.settings`).

## Notes

- The host owns the section header and scroll anchor. Your component starts after the heading.
- Keep the section compact — this lives inside the shared Settings page alongside other sections.
- Use `SettingsField` from `@neon-pilot/extensions/settings` for consistent label/input layout if available,
  or fall back to the inline `Field` helper in the template.
