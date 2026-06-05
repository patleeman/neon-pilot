# Template: settings-section

Contributes a section to the main Settings page at `/settings`. No separate route or nav entry.
Good for integration configuration, feature toggles, and preferences that belong alongside other
system settings rather than on their own page.

Derived from: `system-settings` settings contribution pattern, `system-local-models` settings section.

## Files

- `extension.json` — manifest with one `settingsComponent` contribution and backend actions to load/save settings
- `package.json` — minimal package descriptor
- `src/frontend.tsx` — exports a settings section component rendered by the host
- `src/backend.ts` — action to load and persist settings (replace with your own store)

## Customise

1. Change `"id"` in `extension.json`.
2. Change `contributes.settingsComponent.id`, `sectionId`, `label`, and `description`.
3. Change `"component"` to match your exported component name.
4. Update backend action ids in `extension.json` and the matching `pa.actions.call(...)` ids in `src/frontend.tsx`.
5. Add/remove form fields in `src/frontend.tsx`.
6. Replace the in-memory store in `src/backend.ts` with your persistence layer (e.g. `ctx.settings`).

## Notes

- The host owns the section header and scroll anchor. Your component starts after the heading.
- Keep the section compact — this lives inside the shared Settings page alongside other sections.
- Use `SettingsField` from `@neon-pilot/extensions/settings` for consistent label/input layout if available,
  or fall back to the inline `Field` helper in the template.
- Validate by opening Settings and confirming the contributed section renders, loads settings, saves changes,
  and shows a useful error if the backend action fails.
