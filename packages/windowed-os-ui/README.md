# Windowed OS UI

`@neon-pilot/windowed-os-ui` is the scoped design-system package for the experimental Neon Pilot desktop/windowed shell.

The canonical visual target is the local design package at:

`/Users/patrick/Downloads/Neon Pilot windowed OS design`

Keep this package separate from the stable `@neon-pilot/ui` system. Stable app routes may render inside window frames, but shell chrome, taskbar/start menu, window anatomy, app monograms, accent mapping, and windowed-OS tokens should live here.

Principles:

- Warm parchment surfaces, near-black ink borders, and one accent hue per app.
- Bottom taskbar and Start menu, with Windows/Linux-style minimize, maximize, and close controls.
- Dense product UI; no marketing hero treatment.
- No gradients, blur, emoji-as-chrome, or animation as default UI language.
- Bundle fonts locally; do not rely on runtime Google font loading.
