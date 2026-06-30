import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { type ExtensionHostClient, getExtensionHostClient } from './extensions/extensionHostClient.js';
import { createExtensionHostServerContextSnapshot } from './extensions/extensionHostServerContext.js';
import type {
  ExtensionManifest,
  ExtensionSetupItemActionContribution,
  ExtensionSetupItemContribution,
  ExtensionSetupItemSeverity,
} from './extensions/extensionManifest.js';
import type { ServerRouteContext } from './routes/context.js';
import { invalidateAppTopics } from './shared/appEvents.js';

export type SetupReadinessStatus = 'ready' | 'needs_setup' | 'blocked' | 'not_applicable' | 'unknown';
export type SetupReadinessActionTone = 'default' | 'primary' | 'danger';

export interface SetupReadinessAction {
  id: string;
  label: string;
  tone: SetupReadinessActionTone;
}

export interface SetupReadinessItem {
  key: string;
  extensionId: string;
  extensionName: string;
  id: string;
  title: string;
  description?: string;
  capability?: string;
  severity: ExtensionSetupItemSeverity;
  status: SetupReadinessStatus;
  detail?: string;
  error?: string;
  dismissed: boolean;
  dismissible: boolean;
  actions: SetupReadinessAction[];
  checkedAt: string;
  order: number;
}

export interface SetupReadinessCounts {
  total: number;
  ready: number;
  incomplete: number;
  actionable: number;
  dismissed: number;
  blocked: number;
  unknown: number;
}

export interface SetupReadinessSnapshot {
  checkedAt: string;
  items: SetupReadinessItem[];
  counts: SetupReadinessCounts;
}

interface SetupReadinessState {
  dismissed: Record<string, { dismissedAt: string }>;
}

interface StatusActionResult {
  status?: unknown;
  detail?: unknown;
  description?: unknown;
  actions?: unknown;
}

export interface SetupReadinessDeps {
  extensionHostClient?: ExtensionHostClient;
  now?: () => Date;
  stateFile?: string;
  invalidate?: (...topics: Parameters<typeof invalidateAppTopics>) => void;
}

const DEFAULT_STATE: SetupReadinessState = { dismissed: {} };

function stateFileFor(context: ServerRouteContext): string {
  return join(context.getStateRoot(), 'setup-readiness.json');
}

function readState(path: string): SetupReadinessState {
  if (!existsSync(path)) return DEFAULT_STATE;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<SetupReadinessState>;
    return { dismissed: parsed.dismissed && typeof parsed.dismissed === 'object' ? parsed.dismissed : {} };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(path: string, state: SetupReadinessState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

function itemKey(extensionId: string, itemId: string): string {
  return `${extensionId}:${itemId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asManifest(summary: Record<string, unknown>): ExtensionManifest | null {
  const manifest = summary.manifest;
  return isRecord(manifest) ? (manifest as unknown as ExtensionManifest) : null;
}

function normalizeStatus(value: unknown): SetupReadinessStatus {
  if (value === 'ready' || value === 'needs_setup' || value === 'blocked' || value === 'not_applicable') return value;
  return 'unknown';
}

function normalizeAction(action: ExtensionSetupItemActionContribution): SetupReadinessAction {
  return {
    id: action.id,
    label: action.label,
    tone: action.tone === 'primary' || action.tone === 'danger' ? action.tone : 'default',
  };
}

function filterActions(
  contribution: ExtensionSetupItemContribution,
  result: StatusActionResult,
  status: SetupReadinessStatus,
): SetupReadinessAction[] {
  if (status === 'ready' || status === 'not_applicable') return [];
  const actionIds = Array.isArray(result.actions)
    ? new Set(result.actions.filter((action): action is string => typeof action === 'string'))
    : null;
  return (contribution.actions ?? []).filter((action) => !actionIds || actionIds.has(action.id)).map(normalizeAction);
}

function countsFor(items: SetupReadinessItem[]): SetupReadinessCounts {
  return {
    total: items.length,
    ready: items.filter((item) => item.status === 'ready' || item.status === 'not_applicable').length,
    incomplete: items.filter((item) => item.status !== 'ready' && item.status !== 'not_applicable').length,
    actionable: items.filter((item) => item.status !== 'ready' && item.status !== 'not_applicable' && !item.dismissed).length,
    dismissed: items.filter((item) => item.dismissed).length,
    blocked: items.filter((item) => item.status === 'blocked').length,
    unknown: items.filter((item) => item.status === 'unknown').length,
  };
}

async function invokeStatus(input: {
  client: ExtensionHostClient;
  context: ServerRouteContext;
  extensionId: string;
  actionId: string;
}): Promise<StatusActionResult> {
  const response = await input.client.invokeAction({
    extensionId: input.extensionId,
    actionId: input.actionId,
    input: {},
    serverContextSnapshot: createExtensionHostServerContextSnapshot(input.context),
  });
  if (!response.ok) throw new Error(response.error);
  return isRecord(response.result) ? (response.result as StatusActionResult) : {};
}

export async function readSetupReadiness(context: ServerRouteContext, deps: SetupReadinessDeps = {}): Promise<SetupReadinessSnapshot> {
  const client = deps.extensionHostClient ?? getExtensionHostClient();
  const now = deps.now?.() ?? new Date();
  const checkedAt = now.toISOString();
  const statePath = deps.stateFile ?? stateFileFor(context);
  const state = readState(statePath);
  const { installSummaries } = await client.readRegistryPresentation();
  const items: SetupReadinessItem[] = [];

  for (const summary of installSummaries) {
    const extensionId = typeof summary.id === 'string' ? summary.id : '';
    const extensionName = typeof summary.name === 'string' ? summary.name : extensionId;
    if (!extensionId || summary.status !== 'enabled') continue;
    const manifest = asManifest(summary);
    for (const contribution of manifest?.contributes?.setupItems ?? []) {
      const key = itemKey(extensionId, contribution.id);
      const dismissed = Boolean(state.dismissed[key]);
      try {
        const result = await invokeStatus({ client, context, extensionId, actionId: contribution.statusAction });
        const status = normalizeStatus(result.status);
        if ((status === 'ready' || status === 'not_applicable') && dismissed) {
          delete state.dismissed[key];
        }
        items.push({
          key,
          extensionId,
          extensionName,
          id: contribution.id,
          title: contribution.title,
          description: typeof result.description === 'string' ? result.description : contribution.description,
          capability: contribution.capability,
          severity: contribution.severity ?? 'recommended',
          status,
          detail: typeof result.detail === 'string' ? result.detail : undefined,
          dismissed: Boolean(state.dismissed[key]),
          dismissible: contribution.dismissible !== false,
          actions: filterActions(contribution, result, status),
          checkedAt,
          order: contribution.order ?? 0,
        });
      } catch (error) {
        items.push({
          key,
          extensionId,
          extensionName,
          id: contribution.id,
          title: contribution.title,
          description: contribution.description,
          capability: contribution.capability,
          severity: contribution.severity ?? 'recommended',
          status: 'unknown',
          error: error instanceof Error ? error.message : String(error),
          dismissed,
          dismissible: contribution.dismissible !== false,
          actions: [],
          checkedAt,
          order: contribution.order ?? 0,
        });
      }
    }
  }

  writeState(statePath, state);
  items.sort((a, b) => a.order - b.order || a.extensionName.localeCompare(b.extensionName) || a.title.localeCompare(b.title));
  return { checkedAt, items, counts: countsFor(items) };
}

async function findSetupItem(input: {
  client: ExtensionHostClient;
  extensionId: string;
  itemId: string;
}): Promise<{ manifest: ExtensionManifest; contribution: ExtensionSetupItemContribution } | null> {
  const { installSummaries } = await input.client.readRegistryPresentation();
  const summary = installSummaries.find((candidate) => candidate.id === input.extensionId && candidate.status === 'enabled');
  const manifest = summary && isRecord(summary) ? asManifest(summary) : null;
  const contribution = manifest?.contributes?.setupItems?.find((item) => item.id === input.itemId);
  return manifest && contribution ? { manifest, contribution } : null;
}

export async function runSetupReadinessAction(
  context: ServerRouteContext,
  input: { extensionId: string; itemId: string; actionId: string },
  deps: SetupReadinessDeps = {},
): Promise<SetupReadinessSnapshot> {
  const client = deps.extensionHostClient ?? getExtensionHostClient();
  const found = await findSetupItem({ client, extensionId: input.extensionId, itemId: input.itemId });
  const action = found?.contribution.actions?.find((candidate) => candidate.id === input.actionId);
  if (!found || !action) throw new Error(`Setup action "${input.actionId}" is not declared for "${input.extensionId}:${input.itemId}".`);
  const response = await client.invokeAction({
    extensionId: input.extensionId,
    actionId: action.action,
    input: {},
    serverContextSnapshot: createExtensionHostServerContextSnapshot(context),
  });
  if (!response.ok) throw new Error(response.error);
  const statePath = deps.stateFile ?? stateFileFor(context);
  const state = readState(statePath);
  delete state.dismissed[itemKey(input.extensionId, input.itemId)];
  writeState(statePath, state);
  (deps.invalidate ?? invalidateAppTopics)('readiness');
  return readSetupReadiness(context, deps);
}

export async function dismissSetupReadinessItem(
  context: ServerRouteContext,
  input: { extensionId: string; itemId: string; dismissed: boolean },
  deps: SetupReadinessDeps = {},
): Promise<SetupReadinessSnapshot> {
  const statePath = deps.stateFile ?? stateFileFor(context);
  const state = readState(statePath);
  const key = itemKey(input.extensionId, input.itemId);
  if (input.dismissed) state.dismissed[key] = { dismissedAt: (deps.now?.() ?? new Date()).toISOString() };
  else delete state.dismissed[key];
  writeState(statePath, state);
  (deps.invalidate ?? invalidateAppTopics)('readiness');
  return readSetupReadiness(context, deps);
}
