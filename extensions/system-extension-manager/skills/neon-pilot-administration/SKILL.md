# Neon Pilot Administration

Use the `neon-pilot` CLI for Neon Pilot self-administration when it is available in the agent shell.

## Workflow

1. Discover commands before using an unfamiliar surface:

   ```sh
   neon-pilot commands --json
   ```

2. Prefer JSON for inspection and automation:

   ```sh
   neon-pilot extensions list --json
   neon-pilot cli status --json
   ```

3. List or inspect before mutating shared state. For extension work, validate and reload after edits:

   ```sh
   neon-pilot extensions validate system-example
   neon-pilot extensions reload system-example
   ```

4. Use the CLI for Neon Pilot-owned administration. Use normal shell commands for repository work such as `pnpm`, `git`, `rg`, and file validation.

## Boundaries

- Core owns the `neon-pilot` CLI shell and built-in commands such as `commands`, `help`, `protocol`, and `cli status/install/uninstall`.
- Extensions contribute product-specific CLI commands through `contributes.cliCommands`.
- The agent shell receives Neon Pilot's channel-local CLI bin directory automatically. User shell installation is opt-in through `neon-pilot cli install`.
- Do not edit internal runtime files directly when an extension-contributed CLI command exists for the same operation.
