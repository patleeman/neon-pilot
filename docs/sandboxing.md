# Sandboxing and Process Execution

Neon Pilot routes host-owned process execution through a shared process launcher so sandboxing extensions can wrap commands consistently. Filesystem access should converge on the same authority model through the [Filesystem Authority](filesystem-authority.md): direct file APIs and command sandboxes should share scoped root grants instead of inventing separate policy vocabularies.

## Execution boundary

Extensions and core code should not spawn processes directly. Use the host APIs that route through the shared launcher:

- live-session bash tool
- extension `ctx.shell` and `ctx.git`
- daemon/background run launches
- automation command tasks

When a wrapper is active, tool UI should expose the wrapper metadata, for example a human label or the extension id. This is a visibility contract: users and agents should be able to tell which execution boundary handled a command.

## Registering a process wrapper

Agent extensions can register a process wrapper from their backend agent extension export:

```ts
export function mySandboxAgentExtension(pi) {
  pi.registerBashProcessWrapper(
    'my-sandbox-extension',
    (context) => ({
      ...context,
      command: '/path/to/sandbox',
      args: ['run', '--', context.command, ...context.args],
      shell: false,
    }),
    { label: 'My Sandbox' },
  );
}
```

The wrapper receives `{ command, args, cwd, env, shell, wrappers }` and returns the launch context to execute. Wrappers are applied in registration order. Use stable extension ids for wrapper ids.

## Filesystem root grants

Process wrappers should eventually receive the Filesystem Authority grants for the subject they are launching for. That lets a sandbox wrapper mount or expose the same roots that direct file APIs would allow: workspace read/write, extension private storage, artifact output, temp workspaces, knowledge access, or secrets. The process launcher remains the execution boundary; the Filesystem Authority owns root identity, grants, policy decisions, and audit vocabulary.

## Speculative workspaces

Speculative agent runs, including Model Arena challenger runs, should not write directly into the user's active workspace. Use the host-owned speculative workspace boundary instead:

1. create a temporary workspace from the source directory;
2. prefer APFS clone copies on macOS and fall back to a normal recursive copy when clone support is unavailable;
3. run the challenger command in the temporary workspace;
4. use the generated macOS `sandbox-exec` profile when available to deny writes outside the temporary workspace and explicit writable temp roots;
5. collect a file-tree diff against the source workspace;
6. apply the selected change set back to the source workspace only after the user chooses that run;
7. dispose of the temporary workspace on cancel, rejection, or completion.

The first implementation lives in `packages/desktop/server/filesystem/speculativeWorkspace.ts`. It intentionally does not depend on AgentFS, Treebeard, git worktrees, or an external filesystem daemon. AgentFS-style systems can be tested later as alternative adapters behind the same boundary, but Model Arena should target Neon Pilot's speculative workspace contract rather than a third-party command shape.

## Extension process API policy

Extension backend code must use `ctx.shell` for process execution. Direct Node process APIs are blocked during backend builds and bundle loading for normal extension code:

- `child_process` / `node:child_process`
- `cluster` / `node:cluster`
- `worker_threads` / `node:worker_threads`

This is a guardrail against accidental bypasses, not a hostile-code security boundary. Unknown or hostile extension code still requires out-of-process isolation or a VM/workspace sandbox.
