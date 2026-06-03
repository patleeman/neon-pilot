import vm from 'node:vm';

import type { ExtensionBackendContext, ExtensionSqliteDatabase } from '@neon-pilot/extensions';
import {
  cancelDurableRun,
  getDurableRun,
  pingDaemon,
  startBackgroundRun,
} from '@neon-pilot/extensions/backend/runs';
import { readExtensionSettings } from '@neon-pilot/extensions/backend/settings';

const WORKFLOW_BLOCK_TYPE = 'dynamic_workflow';
const DEFAULT_ALLOWED_TOOLS = ['bash', 'read', 'edit', 'write'];
const MAX_CONCURRENT_AGENTS_CAP = 16;
const MAX_TOTAL_AGENTS_CAP = 1000;
const MAX_WORKFLOW_TIMEOUT_MINUTES_CAP = 24 * 60;
const MAX_NODE_TIMEOUT_MINUTES_CAP = 24 * 60;
const POLL_INTERVAL_MS = 1000;
const MAX_SCRIPT_BYTES = 256 * 1024;
const MAX_RESULT_TEXT = 24 * 1024;
const MAX_CHAT_RESULT_TEXT = 8 * 1024;
const MAX_AGENT_SUMMARY_TEXT = 12 * 1024;

type WorkflowStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
type NodeStatus = 'running' | 'completed' | 'failed' | 'cancelled';

interface WorkflowInput {
  name?: unknown;
  description?: unknown;
  script?: unknown;
  args?: unknown;
  cwd?: unknown;
  model?: unknown;
  agentDefaults?: unknown;
}

interface SavedWorkflowInput {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  script?: unknown;
  args?: unknown;
  cwd?: unknown;
  model?: unknown;
  agentDefaults?: unknown;
}

interface AgentInput {
  prompt?: unknown;
  role?: unknown;
  taskSlug?: unknown;
  model?: unknown;
  allowedTools?: unknown;
  cwd?: unknown;
  timeoutMinutes?: unknown;
}

interface DynamicWorkflowSettings {
  defaultAgentModel?: string;
  defaultAgentAllowedTools: string[];
  maxConcurrentAgents: number;
  maxTotalAgents: number;
  nodeTimeoutMinutes: number;
  workflowTimeoutMinutes: number;
}

interface WorkflowRunRecord {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  cwd: string;
  parentConversationId?: string;
  blockId?: string;
  script: string;
  argsJson: string;
  resultText?: string;
  error?: string;
  activePhase?: string;
  model?: string;
  agentDefaultsJson: string;
  settingsJson: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface WorkflowNodeRecord {
  id: string;
  workflowId: string;
  phase?: string;
  role?: string;
  prompt: string;
  status: NodeStatus;
  runId?: string;
  model?: string;
  allowedToolsJson: string;
  resultText?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface SavedWorkflowRecord {
  id: string;
  name: string;
  description?: string;
  script: string;
  argsJson: string;
  cwd?: string;
  model?: string;
  agentDefaultsJson: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowStore {
  db: ExtensionSqliteDatabase;
}

const STORAGE_STORE_KEY = 'dynamic-workflows.store';

const BUILT_IN_WORKFLOWS = [
  {
    id: 'fanout-review',
    name: 'Fanout Review',
    description: 'Review a set of files or modules in parallel, then return a compact issue summary.',
    args: { files: ['src/example.ts'], model: 'opencode-go/deepseek-v4-flash' },
    agentDefaults: { model: 'opencode-go/deepseek-v4-flash', allowedTools: ['read', 'bash'] },
    script: [
      'await workflow.phase("review");',
      'const reviews = await workflow.map(args.files || [], async (file) => {',
      '  return workflow.agent({',
      '    role: "reviewer",',
      '    taskSlug: "workflow-review",',
      '    model: args.model,',
      '    allowedTools: ["read", "bash"],',
      '    prompt: `Review ${file} for bugs. Return only concise findings with file/line references, or say none found.`',
      '  });',
      '});',
      'await workflow.phase("synthesis");',
      'const confirmed = reviews.filter((item) => item.status === "completed" && item.summary && !/none found/i.test(item.summary));',
      'return workflow.finish({',
      '  summary: `${confirmed.length} review branches reported findings out of ${reviews.length}.`,',
      '  findings: confirmed.map((item) => ({ nodeId: item.nodeId, runId: item.runId, summary: item.summary })),',
      '  inspected: reviews.length',
      '});',
    ].join('\n'),
  },
  {
    id: 'verify-findings',
    name: 'Verify Findings',
    description: 'Send candidate findings to independent verifier agents and return only findings that survive review.',
    args: { findings: [{ summary: 'Candidate issue', file: 'src/example.ts' }] },
    agentDefaults: { model: 'opencode-go/deepseek-v4-flash', allowedTools: ['read', 'bash'] },
    script: [
      'await workflow.phase("verification");',
      'const verdicts = await workflow.map(args.findings || [], async (finding, index) => {',
      '  return workflow.agent({',
      '    role: "verifier",',
      '    taskSlug: "workflow-verify",',
      '    allowedTools: ["read", "bash"],',
      '    prompt: `Try to disprove this finding. Return VALID or INVALID first, then concise evidence. Finding ${index + 1}: ${JSON.stringify(finding)}`',
      '  });',
      '});',
      'const valid = verdicts.filter((item) => /^valid\\b/i.test(item.summary || ""));',
      'return workflow.finish({',
      '  summary: `${valid.length} findings survived verification out of ${verdicts.length}.`,',
      '  verified: valid.map((item) => ({ nodeId: item.nodeId, runId: item.runId, summary: item.summary })),',
      '  rejected: verdicts.length - valid.length',
      '});',
    ].join('\n'),
  },
  {
    id: 'deep-research-lite',
    name: 'Deep Research Lite',
    description: 'Fan out research angles, then synthesize a compact report with source notes.',
    args: { topic: 'Explain the question', angles: ['implementation', 'risks', 'alternatives'] },
    agentDefaults: { model: 'opencode-go/deepseek-v4-flash', allowedTools: ['read', 'bash'] },
    script: [
      'await workflow.phase("research");',
      'const topic = args.topic || "research topic";',
      'const angles = args.angles || ["overview", "risks", "recommendation"];',
      'const notes = await workflow.map(angles, async (angle) => workflow.agent({',
      '  role: "researcher",',
      '  taskSlug: "workflow-research",',
      '  prompt: `Research ${angle} for: ${topic}. Return concise notes and cite local files or commands used when applicable.`',
      '}));',
      'await workflow.phase("synthesis");',
      'return workflow.finish({',
      '  summary: `Completed ${notes.length} research angles for ${topic}.`,',
      '  notes: notes.map((item, index) => ({ angle: angles[index], nodeId: item.nodeId, runId: item.runId, summary: item.summary }))',
      '});',
    ].join('\n'),
  },
] as const;

export function normalizeWorkflowSettings(value: unknown): DynamicWorkflowSettings {
  const record = isRecord(value) ? value : {};
  return {
    defaultAgentModel: readOptionalString(record['dynamicWorkflows.defaultAgentModel'] ?? record.defaultAgentModel),
    defaultAgentAllowedTools: normalizeAllowedTools(
      record['dynamicWorkflows.defaultAgentAllowedTools'] ?? record.defaultAgentAllowedTools,
      DEFAULT_ALLOWED_TOOLS,
    ),
    maxConcurrentAgents: normalizeInteger(
      record['dynamicWorkflows.maxConcurrentAgents'] ?? record.maxConcurrentAgents,
      16,
      1,
      MAX_CONCURRENT_AGENTS_CAP,
    ),
    maxTotalAgents: normalizeInteger(record['dynamicWorkflows.maxTotalAgents'] ?? record.maxTotalAgents, 1000, 1, MAX_TOTAL_AGENTS_CAP),
    nodeTimeoutMinutes: normalizeInteger(
      record['dynamicWorkflows.nodeTimeoutMinutes'] ?? record.nodeTimeoutMinutes,
      30,
      1,
      MAX_NODE_TIMEOUT_MINUTES_CAP,
    ),
    workflowTimeoutMinutes: normalizeInteger(
      record['dynamicWorkflows.workflowTimeoutMinutes'] ?? record.workflowTimeoutMinutes,
      480,
      1,
      MAX_WORKFLOW_TIMEOUT_MINUTES_CAP,
    ),
  };
}

export function resolveAgentModel(input: {
  agentModel?: string;
  agentDefaultsModel?: string;
  toolModel?: string;
  settingsModel?: string;
  conversationModel?: string;
}): string | undefined {
  return (
    readOptionalString(input.agentModel) ??
    readOptionalString(input.agentDefaultsModel) ??
    readOptionalString(input.toolModel) ??
    readOptionalString(input.settingsModel) ??
    readOptionalString(input.conversationModel)
  );
}

export function normalizeAllowedTools(value: unknown, fallback: string[] = []): string[] {
  const raw =
    typeof value === 'string'
      ? value.split(',')
      : Array.isArray(value)
        ? value
        : [];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of raw) {
    const tool = typeof item === 'string' ? item.trim() : String(item ?? '').trim();
    if (!tool || seen.has(tool)) continue;
    seen.add(tool);
    next.push(tool);
  }
  if (Array.isArray(value)) return next;
  return next.length > 0 ? next : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readRequiredString(value: unknown, label: string): string {
  const normalized = readOptionalString(value);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function normalizeInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function safeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function truncateText(text: string, maxLength = MAX_RESULT_TEXT): string {
  const normalized = text.trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trimEnd()}…` : normalized;
}

function formatWorkflowResult(result: unknown, maxLength = MAX_RESULT_TEXT): string {
  if (result === undefined) {
    return [
      'Workflow completed without a result.',
      'The script field is already the body of an async function; do not wrap it in an async IIFE.',
      'Return a value from the script body or call workflow.finish(result).',
    ].join('\n');
  }
  return truncateText(typeof result === 'string' ? result : JSON.stringify(result ?? null, null, 2), maxLength);
}

function formatChatResult(resultText: string, workflowId: string): string {
  const clipped = truncateText(resultText, MAX_CHAT_RESULT_TEXT);
  if (clipped === resultText) return resultText;
  return `${clipped}\n\nResult truncated for chat. Inspect full workflow details in Workflows for ${workflowId}.`;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

async function openStore(ctx: ExtensionBackendContext): Promise<WorkflowStore> {
  if (!ctx.database?.open) {
    return { db: await openStorageBackedDatabase(ctx) };
  }
  const db = await ctx.database.open('dynamic-workflows', {
    migrations: [
      {
        version: 1,
        description: 'create dynamic workflow tables',
        up(database) {
          database.exec(`
            CREATE TABLE IF NOT EXISTS workflow_runs (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              status TEXT NOT NULL,
              cwd TEXT NOT NULL,
              parent_conversation_id TEXT,
              block_id TEXT,
              script TEXT NOT NULL,
              args_json TEXT NOT NULL,
              result_text TEXT,
              error TEXT,
              active_phase TEXT,
              model TEXT,
              agent_defaults_json TEXT NOT NULL,
              settings_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS workflow_nodes (
              id TEXT PRIMARY KEY,
              workflow_id TEXT NOT NULL,
              phase TEXT,
              role TEXT,
              prompt TEXT NOT NULL,
              status TEXT NOT NULL,
              run_id TEXT,
              model TEXT,
              allowed_tools_json TEXT NOT NULL,
              result_text TEXT,
              error TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              completed_at TEXT
            );
            CREATE TABLE IF NOT EXISTS workflow_events (
              id TEXT PRIMARY KEY,
              workflow_id TEXT NOT NULL,
              event_type TEXT NOT NULL,
              message TEXT NOT NULL,
              data_json TEXT NOT NULL,
              created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS workflow_nodes_workflow_id_idx ON workflow_nodes(workflow_id);
            CREATE INDEX IF NOT EXISTS workflow_events_workflow_id_idx ON workflow_events(workflow_id);
          `);
        },
      },
      {
        version: 2,
        description: 'create saved dynamic workflow table',
        up(database) {
          database.exec(`
            CREATE TABLE IF NOT EXISTS saved_workflows (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              script TEXT NOT NULL,
              args_json TEXT NOT NULL,
              cwd TEXT,
              model TEXT,
              agent_defaults_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
          `);
        },
      },
    ],
  });
  return { db };
}

async function openStorageBackedDatabase(ctx: ExtensionBackendContext): Promise<ExtensionSqliteDatabase> {
  const snapshot = isRecord(await ctx.storage.get(STORAGE_STORE_KEY).catch(() => null)) ? await ctx.storage.get(STORAGE_STORE_KEY) : null;
  const record = isRecord(snapshot) ? snapshot : {};
  const runs = new Map<string, Record<string, unknown>>(
    Array.isArray(record.runs) ? record.runs.flatMap((row) => (isRecord(row) && typeof row.id === 'string' ? [[row.id, row]] : [])) : [],
  );
  const nodes = new Map<string, Record<string, unknown>>(
    Array.isArray(record.nodes) ? record.nodes.flatMap((row) => (isRecord(row) && typeof row.id === 'string' ? [[row.id, row]] : [])) : [],
  );
  const saved = new Map<string, Record<string, unknown>>(
    Array.isArray(record.saved) ? record.saved.flatMap((row) => (isRecord(row) && typeof row.id === 'string' ? [[row.id, row]] : [])) : [],
  );
  const events: Record<string, unknown>[] = Array.isArray(record.events) ? record.events.filter(isRecord) : [];

  const persist = () =>
    ctx.storage
      .put(STORAGE_STORE_KEY, {
        runs: Array.from(runs.values()),
        nodes: Array.from(nodes.values()),
        saved: Array.from(saved.values()),
        events,
      })
      .catch(() => undefined);

  return {
    exec() {},
    pragma() {},
    close() {},
    transaction(fn: (...args: unknown[]) => unknown) {
      return fn;
    },
    prepare(sql: string) {
      return {
        run(...params: unknown[]) {
          if (sql.startsWith('INSERT INTO workflow_runs')) {
            runs.set(String(params[0]), {
              id: params[0],
              name: params[1],
              description: params[2],
              status: params[3],
              cwd: params[4],
              parent_conversation_id: params[5],
              block_id: params[6],
              script: params[7],
              args_json: params[8],
              result_text: params[9],
              error: params[10],
              active_phase: params[11],
              model: params[12],
              agent_defaults_json: params[13],
              settings_json: params[14],
              created_at: params[15],
              updated_at: params[16],
              completed_at: params[17],
            });
            void persist();
          } else if (sql.startsWith('DELETE FROM workflow_runs')) {
            runs.delete(String(params[0]));
            void persist();
          } else if (sql.startsWith('INSERT INTO workflow_nodes')) {
            nodes.set(String(params[0]), {
              id: params[0],
              workflow_id: params[1],
              phase: params[2],
              role: params[3],
              prompt: params[4],
              status: params[5],
              run_id: params[6],
              model: params[7],
              allowed_tools_json: params[8],
              result_text: params[9],
              error: params[10],
              created_at: params[11],
              updated_at: params[12],
              completed_at: params[13],
            });
            void persist();
          } else if (sql.startsWith('DELETE FROM workflow_nodes')) {
            nodes.delete(String(params[0]));
            void persist();
          } else if (sql.startsWith('INSERT INTO workflow_events')) {
            events.push({ id: params[0], workflow_id: params[1], event_type: params[2], message: params[3], data_json: params[4], created_at: params[5] });
            void persist();
          } else if (sql.startsWith('INSERT INTO saved_workflows')) {
            saved.set(String(params[0]), {
              id: params[0],
              name: params[1],
              description: params[2],
              script: params[3],
              args_json: params[4],
              cwd: params[5],
              model: params[6],
              agent_defaults_json: params[7],
              created_at: params[8],
              updated_at: params[9],
            });
            void persist();
          } else if (sql.startsWith('DELETE FROM saved_workflows')) {
            saved.delete(String(params[0]));
            void persist();
          }
          return { changes: 1, lastInsertRowid: 1 };
        },
        get(...params: unknown[]) {
          if (sql.includes('FROM workflow_runs')) return runs.get(String(params[0]));
          if (sql.includes('FROM workflow_nodes')) return nodes.get(String(params[0]));
          if (sql.includes('FROM saved_workflows')) return saved.get(String(params[0]));
          return undefined;
        },
        all(...params: unknown[]) {
          if (sql.includes('FROM workflow_nodes')) return Array.from(nodes.values()).filter((row) => row.workflow_id === params[0]);
          if (sql.includes('FROM workflow_events')) return events.filter((row) => row.workflow_id === params[0]);
          if (sql.includes('FROM workflow_runs')) return Array.from(runs.values());
          if (sql.includes('FROM saved_workflows')) return Array.from(saved.values());
          return [];
        },
      };
    },
  } as ExtensionSqliteDatabase;
}

function rowToRun(row: unknown): WorkflowRunRecord | null {
  if (!isRecord(row)) return null;
  const id = readOptionalString(row.id);
  const name = readOptionalString(row.name);
  const status = readOptionalString(row.status) as WorkflowStatus | undefined;
  const cwd = readOptionalString(row.cwd);
  const script = typeof row.script === 'string' ? row.script : '';
  if (!id || !name || !status || !cwd) return null;
  return {
    id,
    name,
    status,
    cwd,
    script,
    description: readOptionalString(row.description),
    parentConversationId: readOptionalString(row.parent_conversation_id),
    blockId: readOptionalString(row.block_id),
    argsJson: typeof row.args_json === 'string' ? row.args_json : 'null',
    resultText: readOptionalString(row.result_text),
    error: readOptionalString(row.error),
    activePhase: readOptionalString(row.active_phase),
    model: readOptionalString(row.model),
    agentDefaultsJson: typeof row.agent_defaults_json === 'string' ? row.agent_defaults_json : '{}',
    settingsJson: typeof row.settings_json === 'string' ? row.settings_json : '{}',
    createdAt: readOptionalString(row.created_at) ?? '',
    updatedAt: readOptionalString(row.updated_at) ?? '',
    completedAt: readOptionalString(row.completed_at),
  };
}

function rowToNode(row: unknown): WorkflowNodeRecord | null {
  if (!isRecord(row)) return null;
  const id = readOptionalString(row.id);
  const workflowId = readOptionalString(row.workflow_id);
  const prompt = typeof row.prompt === 'string' ? row.prompt : '';
  const status = readOptionalString(row.status) as NodeStatus | undefined;
  if (!id || !workflowId || !status) return null;
  return {
    id,
    workflowId,
    prompt,
    status,
    phase: readOptionalString(row.phase),
    role: readOptionalString(row.role),
    runId: readOptionalString(row.run_id),
    model: readOptionalString(row.model),
    allowedToolsJson: typeof row.allowed_tools_json === 'string' ? row.allowed_tools_json : '[]',
    resultText: readOptionalString(row.result_text),
    error: readOptionalString(row.error),
    createdAt: readOptionalString(row.created_at) ?? '',
    updatedAt: readOptionalString(row.updated_at) ?? '',
    completedAt: readOptionalString(row.completed_at),
  };
}

function rowToSavedWorkflow(row: unknown): SavedWorkflowRecord | null {
  if (!isRecord(row)) return null;
  const id = readOptionalString(row.id);
  const name = readOptionalString(row.name);
  const script = typeof row.script === 'string' ? row.script : '';
  if (!id || !name || !script) return null;
  return {
    id,
    name,
    script,
    description: readOptionalString(row.description),
    argsJson: typeof row.args_json === 'string' ? row.args_json : 'null',
    cwd: readOptionalString(row.cwd),
    model: readOptionalString(row.model),
    agentDefaultsJson: typeof row.agent_defaults_json === 'string' ? row.agent_defaults_json : '{}',
    createdAt: readOptionalString(row.created_at) ?? '',
    updatedAt: readOptionalString(row.updated_at) ?? '',
  };
}

function insertRun(store: WorkflowStore, run: WorkflowRunRecord): void {
  store.db
    .prepare(
      `INSERT INTO workflow_runs
       (id, name, description, status, cwd, parent_conversation_id, block_id, script, args_json, result_text, error, active_phase, model, agent_defaults_json, settings_json, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      run.id,
      run.name,
      run.description ?? null,
      run.status,
      run.cwd,
      run.parentConversationId ?? null,
      run.blockId ?? null,
      run.script,
      run.argsJson,
      run.resultText ?? null,
      run.error ?? null,
      run.activePhase ?? null,
      run.model ?? null,
      run.agentDefaultsJson,
      run.settingsJson,
      run.createdAt,
      run.updatedAt,
      run.completedAt ?? null,
    );
}

function updateRun(store: WorkflowStore, runId: string, patch: Partial<WorkflowRunRecord>): void {
  const current = rowToRun(store.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(runId));
  if (!current) return;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  insertOrReplaceRun(store, next);
}

function insertOrReplaceRun(store: WorkflowStore, run: WorkflowRunRecord): void {
  store.db.prepare('DELETE FROM workflow_runs WHERE id = ?').run(run.id);
  insertRun(store, run);
}

function insertNode(store: WorkflowStore, node: WorkflowNodeRecord): void {
  store.db
    .prepare(
      `INSERT INTO workflow_nodes
       (id, workflow_id, phase, role, prompt, status, run_id, model, allowed_tools_json, result_text, error, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      node.id,
      node.workflowId,
      node.phase ?? null,
      node.role ?? null,
      node.prompt,
      node.status,
      node.runId ?? null,
      node.model ?? null,
      node.allowedToolsJson,
      node.resultText ?? null,
      node.error ?? null,
      node.createdAt,
      node.updatedAt,
      node.completedAt ?? null,
    );
}

function updateNode(store: WorkflowStore, nodeId: string, patch: Partial<WorkflowNodeRecord>): void {
  const current = rowToNode(store.db.prepare('SELECT * FROM workflow_nodes WHERE id = ?').get(nodeId));
  if (!current) return;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  store.db.prepare('DELETE FROM workflow_nodes WHERE id = ?').run(nodeId);
  insertNode(store, next);
}

function appendEvent(store: WorkflowStore, workflowId: string, eventType: string, message: string, data?: unknown): void {
  const now = new Date().toISOString();
  store.db
    .prepare('INSERT INTO workflow_events (id, workflow_id, event_type, message, data_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(createId('event'), workflowId, eventType, truncateText(message, 4000), safeJson(data ?? null), now);
}

function insertSavedWorkflow(store: WorkflowStore, saved: SavedWorkflowRecord): void {
  store.db
    .prepare(
      `INSERT INTO saved_workflows
       (id, name, description, script, args_json, cwd, model, agent_defaults_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      saved.id,
      saved.name,
      saved.description ?? null,
      saved.script,
      saved.argsJson,
      saved.cwd ?? null,
      saved.model ?? null,
      saved.agentDefaultsJson,
      saved.createdAt,
      saved.updatedAt,
    );
}

function readSavedWorkflow(store: WorkflowStore, workflowId: string): SavedWorkflowRecord | null {
  return rowToSavedWorkflow(store.db.prepare('SELECT * FROM saved_workflows WHERE id = ?').get(workflowId));
}

function listSavedWorkflowRows(store: WorkflowStore): SavedWorkflowRecord[] {
  return store.db
    .prepare('SELECT * FROM saved_workflows ORDER BY updated_at DESC')
    .all()
    .map(rowToSavedWorkflow)
    .filter((workflow): workflow is SavedWorkflowRecord => Boolean(workflow));
}

function listRuns(store: WorkflowStore, limit = 100): WorkflowRunRecord[] {
  return store.db
    .prepare('SELECT * FROM workflow_runs ORDER BY created_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(500, limit)))
    .map(rowToRun)
    .filter((run): run is WorkflowRunRecord => Boolean(run));
}

function readRun(store: WorkflowStore, workflowId: string): WorkflowRunRecord | null {
  return rowToRun(store.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(workflowId));
}

function readNodes(store: WorkflowStore, workflowId: string): WorkflowNodeRecord[] {
  return store.db
    .prepare('SELECT * FROM workflow_nodes WHERE workflow_id = ? ORDER BY created_at ASC')
    .all(workflowId)
    .map(rowToNode)
    .filter((node): node is WorkflowNodeRecord => Boolean(node));
}

function readEvents(store: WorkflowStore, workflowId: string): Array<{ type: string; message: string; data: unknown; createdAt: string }> {
  return store.db
    .prepare('SELECT * FROM workflow_events WHERE workflow_id = ? ORDER BY created_at ASC')
    .all(workflowId)
    .flatMap((row) => {
      if (!isRecord(row)) return [];
      return [
        {
          type: readOptionalString(row.event_type) ?? 'event',
          message: readOptionalString(row.message) ?? '',
          data: parseJson(typeof row.data_json === 'string' ? row.data_json : undefined, null),
          createdAt: readOptionalString(row.created_at) ?? '',
        },
      ];
    });
}

function summarizeRun(store: WorkflowStore, run: WorkflowRunRecord) {
  const nodes = readNodes(store, run.id);
  return {
    id: run.id,
    name: run.name,
    description: run.description,
    status: run.status,
    cwd: run.cwd,
    parentConversationId: run.parentConversationId,
    blockId: run.blockId,
    activePhase: run.activePhase,
    model: run.model,
    resultText: run.resultText,
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    agents: {
      total: nodes.length,
      running: nodes.filter((node) => node.status === 'running').length,
      completed: nodes.filter((node) => node.status === 'completed').length,
      failed: nodes.filter((node) => node.status === 'failed').length,
      cancelled: nodes.filter((node) => node.status === 'cancelled').length,
    },
    models: Array.from(new Set(nodes.map((node) => node.model).filter(Boolean))),
  };
}

function summarizeSavedWorkflow(saved: SavedWorkflowRecord) {
  return {
    id: saved.id,
    name: saved.name,
    description: saved.description,
    cwd: saved.cwd,
    model: saved.model,
    args: parseJson(saved.argsJson, null),
    agentDefaults: parseJson(saved.agentDefaultsJson, {}),
    script: saved.script,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}

async function updateTranscriptBlock(ctx: ExtensionBackendContext, store: WorkflowStore, workflowId: string): Promise<void> {
  const run = readRun(store, workflowId);
  if (!run?.parentConversationId) return;
  const summary = summarizeRun(store, run);
  const title = `Dynamic workflow: ${run.name} [${run.status}]`;
  try {
    if (run.blockId) {
      await ctx.conversations.updateTranscriptBlock({
        conversationId: run.parentConversationId,
        blockType: WORKFLOW_BLOCK_TYPE,
        blockId: run.blockId,
        title,
        data: summary,
      });
      return;
    }
    const { blockId } = await ctx.conversations.appendTranscriptBlock({
      conversationId: run.parentConversationId,
      blockType: WORKFLOW_BLOCK_TYPE,
      title,
      data: summary,
    });
    updateRun(store, workflowId, { blockId });
  } catch {
    // Some tests and non-live contexts do not have transcript capabilities; persistence still records the workflow.
  }
}

async function readSettings(ctx: ExtensionBackendContext): Promise<DynamicWorkflowSettings> {
  try {
    return normalizeWorkflowSettings(await readExtensionSettings());
  } catch {
    return normalizeWorkflowSettings(await ctx.storage.get('settings'));
  }
}

function getToolContext(ctx: ExtensionBackendContext): {
  conversationId?: string;
  cwd?: string;
  sessionFile?: string;
  conversationModel?: string;
} {
  const modelRef = (ctx.agentToolContext as { model?: { id?: string } } | undefined)?.model?.id;
  return {
    conversationId: ctx.toolContext?.conversationId ?? ctx.toolContext?.sessionId,
    cwd: ctx.toolContext?.cwd,
    sessionFile: ctx.toolContext?.sessionFile,
    conversationModel: modelRef,
  };
}

function normalizeWorkflowInput(input: unknown, ctx: ExtensionBackendContext, settings: DynamicWorkflowSettings) {
  const record = isRecord(input) ? (input as WorkflowInput) : {};
  const script = readRequiredString(record.script, 'script');
  if (Buffer.byteLength(script, 'utf-8') > MAX_SCRIPT_BYTES) {
    throw new Error(`script must be ${MAX_SCRIPT_BYTES} bytes or smaller.`);
  }
  const toolContext = getToolContext(ctx);
  const agentDefaults = isRecord(record.agentDefaults) ? record.agentDefaults : {};
  const defaultModel = resolveAgentModel({
    agentDefaultsModel: readOptionalString(agentDefaults.model),
    toolModel: readOptionalString(record.model),
    settingsModel: settings.defaultAgentModel,
    conversationModel: toolContext.conversationModel,
  });
  return {
    name: readRequiredString(record.name, 'name'),
    description: readOptionalString(record.description),
    script,
    args: record.args,
    cwd: readOptionalString(record.cwd) ?? toolContext.cwd ?? ctx.runtime.getRepoRoot(),
    parentConversationId: toolContext.conversationId,
    parentSessionFile: toolContext.sessionFile,
    model: defaultModel,
    agentDefaults: {
      model: readOptionalString(agentDefaults.model),
      allowedTools: normalizeAllowedTools(agentDefaults.allowedTools, settings.defaultAgentAllowedTools),
    },
  };
}

function createLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function runLimited<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await fn();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}

async function waitForRunCompletion(runId: string, timeoutMs: number, signal?: AbortSignal): Promise<{ summary: string; status: NodeStatus }> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) throw new Error('Workflow cancelled.');
    const detail = (await getDurableRun(runId)) as { run?: { status?: { status?: string }; result?: { summary?: string; error?: string } } } | undefined;
    const status = detail?.run?.status?.status;
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      const summary = detail?.run?.result?.summary ?? detail?.run?.result?.error ?? `Subagent ${status}.`;
      return {
        summary: truncateText(summary, MAX_AGENT_SUMMARY_TEXT),
        status: status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'failed',
      };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Subagent ${runId} timed out.`);
}

async function runWorkflowScript(input: {
  ctx: ExtensionBackendContext;
  store: WorkflowStore;
  workflowId: string;
  script: string;
  args: unknown;
  cwd: string;
  settings: DynamicWorkflowSettings;
  toolModel?: string;
  agentDefaults: { model?: string; allowedTools: string[] };
  signal?: AbortSignal;
}): Promise<unknown> {
  let currentPhase: string | undefined;
  let totalAgents = 0;
  let finished = false;
  let finalResult: unknown;
  const runLimited = createLimiter(input.settings.maxConcurrentAgents);

  const workflowApi = {
    phase: async (name: unknown, fn: unknown) => {
      const phase = readRequiredString(name, 'phase name');
      currentPhase = phase;
      updateRun(input.store, input.workflowId, { activePhase: phase });
      appendEvent(input.store, input.workflowId, 'phase.start', phase);
      await updateTranscriptBlock(input.ctx, input.store, input.workflowId);
      if (fn === undefined) return phase;
      if (typeof fn !== 'function') throw new Error('workflow.phase requires a function when a second argument is provided.');
      try {
        const result = await fn();
        appendEvent(input.store, input.workflowId, 'phase.end', phase);
        return result;
      } finally {
        currentPhase = undefined;
      }
    },
    agent: async (agentInput: unknown) =>
      runLimited(async () => {
        if (input.signal?.aborted) throw new Error('Workflow cancelled.');
        totalAgents += 1;
        if (totalAgents > input.settings.maxTotalAgents) {
          throw new Error(`Workflow exceeded maxTotalAgents (${input.settings.maxTotalAgents}).`);
        }
        const record = isRecord(agentInput) ? (agentInput as AgentInput) : {};
        const prompt = readRequiredString(record.prompt, 'agent prompt');
        const role = readOptionalString(record.role) ?? 'worker';
        const model = resolveAgentModel({
          agentModel: readOptionalString(record.model),
          agentDefaultsModel: input.agentDefaults.model,
          toolModel: input.toolModel,
          settingsModel: input.settings.defaultAgentModel,
        });
        const hasExplicitAllowedTools = Object.prototype.hasOwnProperty.call(record, 'allowedTools');
        const allowedTools = normalizeAllowedTools(record.allowedTools, input.agentDefaults.allowedTools);
        const cwd = readOptionalString(record.cwd) ?? input.cwd;
        const timeoutMinutes = normalizeInteger(record.timeoutMinutes, input.settings.nodeTimeoutMinutes, 1, MAX_NODE_TIMEOUT_MINUTES_CAP);
        const nodeId = createId('wf-node');
        const now = new Date().toISOString();
        insertNode(input.store, {
          id: nodeId,
          workflowId: input.workflowId,
          phase: currentPhase,
          role,
          prompt,
          status: 'running',
          model,
          allowedToolsJson: safeJson(allowedTools),
          createdAt: now,
          updatedAt: now,
        });
        appendEvent(input.store, input.workflowId, 'agent.start', role, { nodeId, model, allowedTools });
        await updateTranscriptBlock(input.ctx, input.store, input.workflowId);

        if (!(await pingDaemon())) throw new Error('Daemon is not responding. Ensure the desktop app is running.');
        const result = (await startBackgroundRun({
          taskSlug: readOptionalString(record.taskSlug) ?? `workflow-${role}`,
          cwd,
          agent: {
            prompt,
            ...(model ? { model } : {}),
            ...(hasExplicitAllowedTools || allowedTools.length > 0 ? { allowedTools } : {}),
          },
          source: {
            type: 'workflow',
            id: input.workflowId,
          },
          manifestMetadata: {
            workflowId: input.workflowId,
            workflowNodeId: nodeId,
            workflowPhase: currentPhase,
            workflowRole: role,
          },
        })) as { accepted?: boolean; runId?: string; reason?: string };
        if (!result.accepted || !result.runId) {
          const reason = result.reason ?? 'Could not start workflow subagent.';
          updateNode(input.store, nodeId, { status: 'failed', error: reason, completedAt: new Date().toISOString() });
          throw new Error(reason);
        }
        updateNode(input.store, nodeId, { runId: result.runId });

        try {
          const completed = await waitForRunCompletion(result.runId, timeoutMinutes * 60 * 1000, input.signal);
          updateNode(input.store, nodeId, {
            status: completed.status,
            resultText: completed.summary,
            completedAt: new Date().toISOString(),
            ...(completed.status === 'failed' ? { error: completed.summary } : {}),
          });
          appendEvent(input.store, input.workflowId, `agent.${completed.status}`, role, { nodeId, runId: result.runId });
          await updateTranscriptBlock(input.ctx, input.store, input.workflowId);
          return { nodeId, runId: result.runId, status: completed.status, summary: completed.summary, model, allowedTools };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          updateNode(input.store, nodeId, { status: 'failed', error: message, completedAt: new Date().toISOString() });
          appendEvent(input.store, input.workflowId, 'agent.failed', message, { nodeId, runId: result.runId });
          await updateTranscriptBlock(input.ctx, input.store, input.workflowId);
          throw error;
        }
      }),
    map: async (items: unknown, mapper: unknown) => {
      if (!Array.isArray(items)) throw new Error('workflow.map requires an array.');
      if (typeof mapper !== 'function') throw new Error('workflow.map requires a mapper function.');
      return Promise.all(items.map((item, index) => mapper(item, index)));
    },
    log: (message: unknown, data?: unknown) => {
      appendEvent(input.store, input.workflowId, 'log', typeof message === 'string' ? message : JSON.stringify(message), data);
    },
    finish: (result: unknown) => {
      finished = true;
      finalResult = result;
      return result;
    },
  };

  const sandbox = vm.createContext(
    {
      workflow: Object.freeze(workflowApi),
      args: input.args,
      console: Object.freeze({
        log: (...values: unknown[]) => workflowApi.log(values.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' ')),
      }),
    },
    { name: `dynamic-workflow:${input.workflowId}`, codeGeneration: { strings: false, wasm: false } },
  );
  const script = new vm.Script(`"use strict";\n(async () => {\n${input.script}\n})()`);
  const result = await Promise.race([
    script.runInContext(sandbox, { timeout: 1000 }) as Promise<unknown>,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Workflow timed out after ${input.settings.workflowTimeoutMinutes} minutes.`)), input.settings.workflowTimeoutMinutes * 60 * 1000).unref();
    }),
  ]);
  return finished ? finalResult : result;
}

export async function workflow(input: unknown, ctx: ExtensionBackendContext) {
  const settings = await readSettings(ctx);
  const normalized = normalizeWorkflowInput(input, ctx, settings);
  const store = await openStore(ctx);
  const now = new Date().toISOString();
  const workflowId = createId('workflow');
  const run: WorkflowRunRecord = {
    id: workflowId,
    name: normalized.name,
    description: normalized.description,
    status: 'running',
    cwd: normalized.cwd,
    parentConversationId: normalized.parentConversationId,
    script: normalized.script,
    argsJson: safeJson(normalized.args ?? null),
    model: normalized.model,
    agentDefaultsJson: safeJson(normalized.agentDefaults),
    settingsJson: safeJson(settings),
    createdAt: now,
    updatedAt: now,
  };
  insertRun(store, run);
  appendEvent(store, workflowId, 'workflow.start', normalized.name, { model: normalized.model });
  await updateTranscriptBlock(ctx, store, workflowId);

  try {
    const result = await runWorkflowScript({
      ctx,
      store,
      workflowId,
      script: normalized.script,
      args: normalized.args,
      cwd: normalized.cwd,
      settings,
      toolModel: normalized.model,
      agentDefaults: normalized.agentDefaults,
      signal: ctx.agentToolContext?.signal,
    });
    const resultText = formatWorkflowResult(result);
    const chatResultText = formatChatResult(resultText, workflowId);
    updateRun(store, workflowId, { status: 'completed', resultText, completedAt: new Date().toISOString() });
    appendEvent(store, workflowId, 'workflow.completed', resultText);
    await updateTranscriptBlock(ctx, store, workflowId);
    return {
      content: [{ type: 'text' as const, text: `Workflow ${normalized.name} completed.\n\n${chatResultText}` }],
      details: { workflowId, status: 'completed', result: chatResultText, fullResultStored: resultText !== chatResultText },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status: WorkflowStatus = ctx.agentToolContext?.signal?.aborted ? 'cancelled' : 'failed';
    updateRun(store, workflowId, { status, error: message, completedAt: new Date().toISOString() });
    appendEvent(store, workflowId, `workflow.${status}`, message);
    await updateTranscriptBlock(ctx, store, workflowId);
    return {
      content: [{ type: 'text' as const, text: `Workflow ${normalized.name} ${status}: ${message}` }],
      isError: true,
      details: { workflowId, status, error: message },
    };
  }
}

export async function listWorkflows(input: unknown, ctx: ExtensionBackendContext) {
  const limit = isRecord(input) ? normalizeInteger(input.limit, 100, 1, 500) : 100;
  const store = await openStore(ctx);
  return { workflows: listRuns(store, limit).map((run) => summarizeRun(store, run)) };
}

export async function getWorkflow(input: unknown, ctx: ExtensionBackendContext) {
  const workflowId = readRequiredString(isRecord(input) ? input.workflowId : undefined, 'workflowId');
  const store = await openStore(ctx);
  const run = readRun(store, workflowId);
  if (!run) throw new Error(`Workflow not found: ${workflowId}`);
  return {
    workflow: summarizeRun(store, run),
    script: run.script,
    args: parseJson(run.argsJson, null),
    nodes: readNodes(store, workflowId).map((node) => ({
      ...node,
      allowedTools: parseJson<string[]>(node.allowedToolsJson, []),
    })),
    events: readEvents(store, workflowId),
  };
}

export async function cancelWorkflow(input: unknown, ctx: ExtensionBackendContext) {
  const workflowId = readRequiredString(isRecord(input) ? input.workflowId : undefined, 'workflowId');
  const store = await openStore(ctx);
  const run = readRun(store, workflowId);
  if (!run) throw new Error(`Workflow not found: ${workflowId}`);
  const nodes = readNodes(store, workflowId).filter((node) => node.status === 'running' && node.runId);
  for (const node of nodes) {
    await cancelDurableRun(node.runId as string).catch(() => undefined);
    updateNode(store, node.id, { status: 'cancelled', completedAt: new Date().toISOString() });
  }
  updateRun(store, workflowId, { status: 'cancelled', completedAt: new Date().toISOString() });
  appendEvent(store, workflowId, 'workflow.cancelled', 'Workflow cancelled from UI or tool action.');
  await updateTranscriptBlock(ctx, store, workflowId);
  return { ok: true, workflowId, cancelledNodes: nodes.length };
}

export async function listWorkflowTemplates() {
  return {
    templates: BUILT_IN_WORKFLOWS.map((template) => ({ ...template })),
  };
}

export async function saveWorkflow(input: unknown, ctx: ExtensionBackendContext) {
  const record = isRecord(input) ? (input as SavedWorkflowInput) : {};
  const script = readRequiredString(record.script, 'script');
  if (Buffer.byteLength(script, 'utf-8') > MAX_SCRIPT_BYTES) {
    throw new Error(`script must be ${MAX_SCRIPT_BYTES} bytes or smaller.`);
  }
  const id = readOptionalString(record.id) ?? createId('saved-workflow');
  const store = await openStore(ctx);
  const existing = readSavedWorkflow(store, id);
  const now = new Date().toISOString();
  if (existing) store.db.prepare('DELETE FROM saved_workflows WHERE id = ?').run(id);
  insertSavedWorkflow(store, {
    id,
    name: readRequiredString(record.name, 'name'),
    description: readOptionalString(record.description),
    script,
    argsJson: safeJson(record.args ?? null),
    cwd: readOptionalString(record.cwd),
    model: readOptionalString(record.model),
    agentDefaultsJson: safeJson(isRecord(record.agentDefaults) ? record.agentDefaults : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return { ok: true, workflow: summarizeSavedWorkflow(readSavedWorkflow(store, id) as SavedWorkflowRecord) };
}

export async function listSavedWorkflows(_input: unknown, ctx: ExtensionBackendContext) {
  const store = await openStore(ctx);
  return { workflows: listSavedWorkflowRows(store).map(summarizeSavedWorkflow) };
}

export async function deleteSavedWorkflow(input: unknown, ctx: ExtensionBackendContext) {
  const id = readRequiredString(isRecord(input) ? input.id : undefined, 'id');
  const store = await openStore(ctx);
  store.db.prepare('DELETE FROM saved_workflows WHERE id = ?').run(id);
  return { ok: true, id };
}

export async function runSavedWorkflow(input: unknown, ctx: ExtensionBackendContext) {
  const id = readRequiredString(isRecord(input) ? input.id : undefined, 'id');
  const store = await openStore(ctx);
  const saved = readSavedWorkflow(store, id);
  if (!saved) throw new Error(`Saved workflow not found: ${id}`);
  const overrides = isRecord(input) ? input : {};
  return workflow(
    {
      name: readOptionalString(overrides.name) ?? saved.name,
      description: readOptionalString(overrides.description) ?? saved.description,
      script: saved.script,
      args: overrides.args ?? parseJson(saved.argsJson, null),
      cwd: readOptionalString(overrides.cwd) ?? saved.cwd,
      model: readOptionalString(overrides.model) ?? saved.model,
      agentDefaults: isRecord(overrides.agentDefaults) ? overrides.agentDefaults : parseJson(saved.agentDefaultsJson, {}),
    },
    ctx,
  );
}
