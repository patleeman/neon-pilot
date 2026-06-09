---
name: dynamic-workflows
description: Use when a task benefits from JavaScript orchestration, explicit phases, structured progress logs, parallel fanout, or multiple daemon-backed subagents coordinated through the workflow tool.
metadata:
  id: dynamic-workflows
  title: Dynamic Workflows
  summary: Built-in guidance for model-authored workflow scripts, phases, logs, and workflow-spawned subagents.
  status: active
tools:
  - workflow
---

# Dynamic Workflows

Use the `workflow` tool when the task is better handled as an explicit coordinator than as one long foreground turn. Good fits include parallel investigation, multi-phase validation, fanout over files/modules, and workflows where progress should remain visible in the transcript and Workflows page.

Do not use `workflow` for a simple one-step edit or command. Normal foreground work is cheaper and easier to inspect for small tasks.

## Runtime Contract

The `script` field is the body of an async function. Do not use `module.exports`, `export default`, or top-level module syntax.

The host wraps scripts like this:

```js
'use strict';
(async () => {
  // script body goes here
})();
```

Available globals:

| API                            | Purpose                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `workflow.phase(name)`         | Set the active phase shown in persistence and transcript status.                     |
| `workflow.agent(input)`        | Spawn a daemon-backed subagent from the desktop/product runtime.                     |
| `workflow.map(items, fn)`      | Run async work across items; `workflow.agent` calls are capped by workflow settings. |
| `workflow.log(message, data?)` | Add a structured workflow event.                                                     |
| `workflow.finish(result)`      | Set the final workflow result.                                                       |
| `args`                         | The tool input `args` value.                                                         |
| `console.log(...)`             | Routed to `workflow.log`.                                                            |

The script itself is orchestration-only. It does not receive direct shell, filesystem, app internals, `process`, or `require` access. Real work should happen in subagents.

Keep the final result compact. Subagent prompts, run ids, statuses, summaries, errors, and logs are persisted as workflow nodes and events and can be inspected in the Workflows page. Do not return every raw subagent result to chat. Return a small object with `summary`, `counts`, and only the key findings the parent agent needs.

## Desktop Runtime Requirement

`workflow.agent()` starts daemon-backed background agent runs through the desktop/product runtime. It requires the daemon and extension-host RPC to be available to the process running the workflow.

If `workflow.agent()` fails with an extension-host or daemon connectivity error, report that the runtime could not spawn workflow agents. Then either:

- run a workflow that only uses phases/logs/finish, or
- perform the work directly in the foreground using normal tools.

## Tool Input

Use the `workflow` tool with:

```json
{
  "name": "Short workflow name",
  "description": "Optional operator-facing description",
  "args": { "items": ["src/a.ts", "src/b.ts"] },
  "cwd": "/absolute/workspace/path",
  "model": "optional/default-agent-model",
  "agentDefaults": {
    "model": "opencode-go/deepseek-v4-flash",
    "allowedTools": ["read", "bash"]
  },
  "script": "await workflow.phase('plan'); workflow.log('starting'); return workflow.finish('done');"
}
```

## Subagent Input

`workflow.agent(input)` accepts:

```ts
{
  prompt: string;
  role?: string;
  taskSlug?: string;
  model?: string;
  allowedTools?: string[];
  cwd?: string;
  timeoutMinutes?: number;
}
```

`prompt` is required. Keep prompts self-contained: include the goal, relevant paths, expected output shape, and any constraints.

## Model Selection

Workflow subagent model precedence is:

1. `workflow.agent({ model })`
2. tool input `agentDefaults.model`
3. tool input `model`
4. extension setting `dynamicWorkflows.defaultAgentModel`
5. the current/default conversation model

Prefer cheap capable models for broad fanout when appropriate, for example `opencode-go/deepseek-v4-flash`. Override individual agents when a step needs a stronger model.

## Examples

Finish-only workflow:

```js
await workflow.phase('preparation');
workflow.log('checking inputs', { args });
return workflow.finish({ ok: true });
```

Parallel file review:

```js
await workflow.phase('review');

const results = await workflow.map(args.files, async (file) => {
  return workflow.agent({
    role: 'reviewer',
    taskSlug: 'workflow-review',
    model: args.model,
    allowedTools: ['read', 'bash'],
    prompt: `Review ${file} for bugs. Return concise findings with file/line references.`,
  });
});

await workflow.phase('synthesis');
const findings = results
  .filter((item) => item.status === 'completed' && item.summary && !/none found/i.test(item.summary))
  .map((item) => ({ nodeId: item.nodeId, runId: item.runId, summary: item.summary }));
workflow.log('reviews complete', { count: results.length, findings: findings.length });
return workflow.finish({
  summary: `${findings.length} review branches reported findings out of ${results.length}.`,
  counts: { reviewed: results.length, findings: findings.length },
  findings,
});
```

Phased implementation and validation:

```js
await workflow.phase('implementation');
const implementation = await workflow.agent({
  role: 'implementer',
  prompt: 'Implement the requested change. Keep edits scoped. Report files changed.',
});

await workflow.phase('validation');
const validation = await workflow.agent({
  role: 'validator',
  allowedTools: ['read', 'bash'],
  prompt: 'Validate the implementation as the user would see it. Run relevant checks and report remaining risk.',
});

return workflow.finish({
  summary: 'Implementation and validation agents completed.',
  implementation: { nodeId: implementation.nodeId, runId: implementation.runId, summary: implementation.summary },
  validation: { nodeId: validation.nodeId, runId: validation.runId, summary: validation.summary },
});
```

Verification pass:

```js
await workflow.phase('verification');
const verdicts = await workflow.map(args.findings || [], async (finding, index) => {
  return workflow.agent({
    role: 'verifier',
    taskSlug: 'workflow-verify',
    allowedTools: ['read', 'bash'],
    prompt: `Try to disprove this finding. Return VALID or INVALID first, then concise evidence. Finding ${index + 1}: ${JSON.stringify(finding)}`,
  });
});

const verified = verdicts.filter((item) => /^valid\b/i.test(item.summary || ''));
return workflow.finish({
  summary: `${verified.length} findings survived verification out of ${verdicts.length}.`,
  counts: { candidates: verdicts.length, verified: verified.length, rejected: verdicts.length - verified.length },
  verified: verified.map((item) => ({ nodeId: item.nodeId, runId: item.runId, summary: item.summary })),
});
```

Bad pattern:

```js
// Do not do this. The host already wraps the script in an async function.
(async () => {
  return workflow.finish({ ok: true });
})();
```

Good pattern:

```js
await workflow.phase('done');
return workflow.finish({ ok: true });
```

## Reporting

After a workflow completes, summarize:

- workflow status and final result
- active phases or key events
- subagent count and model(s) used
- any failures or runtime limitations
- where the user can inspect it: transcript block and Workflows page
