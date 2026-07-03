# Windowed OS UI

`@neon-pilot/windowed-os-ui` is the scoped design-system package for the experimental Neon Pilot desktop/windowed shell.

The canonical visual target is the local design package at:

`/Users/patrick/Downloads/Neon Pilot windowed OS design`

Keep this package separate from the stable `@neon-pilot/ui` system. Stable app routes may render inside window frames, but shell chrome, taskbar/start menu, window anatomy, app monograms, accent mapping, and windowed-OS tokens should live here.

CSS entry points:

- `@neon-pilot/windowed-os-ui/tokens.css` contains the scoped `.windowed-os-shell` design tokens extracted from the canonical design package.
- `@neon-pilot/windowed-os-ui/styles.css` imports the tokens and adds the full shell/component/page styling used by Storybook and the desktop app.

Theme modes:

- Light mode is the default. It can be made explicit with `data-wos-theme="light"` on `.windowed-os-shell`.
- Dark mode is opt-in with `data-wos-theme="dark"` on `.windowed-os-shell`.
- Theme tokens stay inside this package; do not couple windowed OS colors to the stable Neon Pilot theme variables.

Principles:

- Warm parchment surfaces, near-black ink borders, and one accent hue per app.
- Bottom taskbar and Start menu, with Windows/Linux-style minimize, maximize, and close controls.
- Dense product UI; no marketing hero treatment.
- No gradients, blur, emoji-as-chrome, or animation as default UI language.
- Bundle fonts locally; do not rely on runtime Google font loading.

## Local Workflow

Use this package as the canonical implementation target for windowed OS shell chrome and page primitives.

- `pnpm --dir packages/windowed-os-ui run storybook` starts the isolated Storybook on port `6016`.
- `pnpm --dir packages/windowed-os-ui run build:storybook` builds the canonical visual reference.
- `pnpm --dir packages/windowed-os-ui run test` runs the package guardrails for Storybook coverage and stable-shell leakage.
- `pnpm --dir packages/windowed-os-ui run build` type-checks the package exports.

Keep stable `@neon-pilot/ui` page chrome out of canonical stories. When a desktop app needs new reusable windowed controls, add them here first, then consume them from the desktop shell or first-party extension windowed branches.
