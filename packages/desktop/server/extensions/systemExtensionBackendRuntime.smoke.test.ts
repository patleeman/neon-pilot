import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listExtensionInstallSummaries } from './extensionRegistry.js';

const HOST_BACKED_EXTENSION_IDS = new Set(['system-prompt-assembly', 'system-skills']);

const BACKEND_ACTION_SMOKE_SCRIPT = String.raw`
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const extensionId = process.argv[1];
const backendUrl = process.argv[2];
const repoRoot = process.argv[3];
const tempRoot = mkdtempSync(join(tmpdir(), 'neon-pilot-extension-runtime-smoke-' + extensionId + '-'));
const runtimeDir = join(tempRoot, 'runtime');
const knowledgeRoot = join(tempRoot, 'knowledge');
const stateRoot = join(tempRoot, 'state');
const configRoot = join(tempRoot, 'config');
const cwd = join(tempRoot, 'workspace');
const sessionFile = join(tempRoot, 'session.json');

mkdirSync(runtimeDir, { recursive: true });
mkdirSync(knowledgeRoot, { recursive: true });
mkdirSync(stateRoot, { recursive: true });
mkdirSync(configRoot, { recursive: true });
mkdirSync(cwd, { recursive: true });
writeFileSync(join(knowledgeRoot, 'smoke.md'), '# Smoke\n');
writeFileSync(sessionFile, JSON.stringify({ id: 'smoke-session', entries: [] }, null, 2));

process.env.NEON_PILOT_REPO_ROOT = repoRoot;
process.env.NEON_PILOT_STATE_ROOT = stateRoot;
process.env.NEON_PILOT_CONFIG_ROOT = configRoot;
process.env.NEON_PILOT_KNOWLEDGE_ROOT = knowledgeRoot;
delete process.env.NEON_PILOT_DESKTOP_NATIVE_MODULES_DIR;

const module = await import(backendUrl);
const storage = new Map();
const invalidatedTopics = [];
const conversations = [];
const registeredTools = [];
const registeredCommands = [];
const registeredEvents = [];
const appendedEntries = [];
const sentMessages = [];
let activeTools = [];
let sessionEntries = [];
let metadataValue = null;

const ctx = {
  extensionId,
  profile: 'shared',
  runtimeDir,
  profileSettingsFilePath: join(tempRoot, 'profile-settings.json'),
  toolContext: {
    conversationId: 'smoke-conversation',
    sessionId: 'smoke-session',
    sessionFile,
    cwd,
    preferredVisionModel: 'test-provider:test-model',
  },
  ui: {
    invalidate(topics) {
      invalidatedTopics.push(topics);
    },
    notify() {},
  },
  log: {
    info() {},
    warn() {},
    error() {},
    debug() {},
  },
  shell: {
    async exec(input) {
      if (input.command === 'sh' && Array.isArray(input.args) && input.args[0] === '-lc') {
        return { stdout: input.args[1] + '\n', stderr: '', executionWrappers: [] };
      }
      return { stdout: 'ok\n', stderr: '', executionWrappers: [] };
    },
    async spawn() {
      return { pid: 12345, executionWrappers: [], kill() {} };
    },
  },
  secrets: {
    get() {
      return undefined;
    },
  },
  storage: {
    async get(key) {
      return storage.get(key);
    },
    async put(key, value) {
      storage.set(key, value);
    },
    async delete(key) {
      storage.delete(key);
    },
  },
  extensions: {
    setEnabled() {},
  },
  conversations: {
    async get() {
      return { running: false, toolNames: activeTools };
    },
    async create(input) {
      const conversation = { id: 'smoke-created-' + (conversations.length + 1), ...input };
      conversations.push(conversation);
      return conversation;
    },
    async setTitle() {},
    async appendCustomEntry(_conversationId, customType, data) {
      appendedEntries.push({ customType, data });
      return { ok: true };
    },
    async appendVisibleCustomMessage() {},
    async setActiveTools(_conversationId, toolNames) {
      activeTools = toolNames;
      return { conversationId: 'smoke-conversation', toolNames };
    },
    metadata: {
      async get() {
        return metadataValue;
      },
      async set(input) {
        metadataValue = input.values;
      },
      async delete() {},
    },
  },
  runtime: {
    getRepoRoot() {
      return repoRoot;
    },
    getLiveSessionResourceOptions() {
      return { cwd, additionalSkillPaths: [] };
    },
  },
  agentToolContext: {
    cwd,
    sessionManager: {
      getSessionId: () => 'smoke-session',
      getSessionFile: () => sessionFile,
      getCwd: () => cwd,
      getEntries: () => sessionEntries,
    },
  },
};

const pi = {
  registerTool(tool) {
    registeredTools.push(tool);
  },
  getAllTools() {
    return [
      {
        name: 'read',
        description: 'Read file contents.',
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
        sourceInfo: { source: 'builtin' },
      },
      ...registeredTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        sourceInfo: { source: 'extension' },
      })),
    ];
  },
  getActiveTools() {
    return activeTools;
  },
  setActiveTools(toolNames) {
    activeTools = toolNames;
  },
  registerCommand(command, handler) {
    registeredCommands.push({ command, handler });
  },
  on(eventName, handler) {
    registeredEvents.push({ eventName, handler });
  },
  appendEntry(customType, data) {
    appendedEntries.push({ customType, data });
  },
  sendUserMessage(message) {
    sentMessages.push({ type: 'user', message });
  },
  sendMessage(message) {
    sentMessages.push({ type: 'assistant', message });
  },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectReject(run, pattern) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(pattern.test(message), 'Unexpected rejection for ' + extensionId + ': ' + message);
    return;
  }
  throw new Error(extensionId + ' smoke expected a validation error');
}

async function smokeAgentFactory(exportName) {
  const factory = exportName === 'default' ? module.default : module[exportName];
  assert(typeof factory === 'function', extensionId + ': missing agent factory ' + exportName);
  const registration = factory(pi);
  if (typeof registration === 'function') {
    registration(pi);
  }
  assert(registeredTools.length + registeredCommands.length + registeredEvents.length > 0, extensionId + ': agent factory registered nothing');
}

const smokes = {
  async 'system-artifacts'() {
    const result = await module.artifact({ action: 'list' }, ctx);
    assert(result.action === 'list', 'artifact list did not return list action');
  },
  async 'system-auto-mode'() {
    await smokeAgentFactory('createConversationAutoModeAgentExtension');
    const goal = registeredTools.find((tool) => tool.name === 'goal');
    assert(goal?.execute, 'goal tool was not registered');
    const result = await goal.execute('smoke', { objective: 'smoke test goal' }, undefined, undefined, ctx.agentToolContext);
    assert(result?.content?.[0]?.text?.includes('Goal set'), 'goal did not execute');
  },
  async 'system-automations'() {
    assert(typeof module.deferredResume === 'function', 'deferred resume action missing');
    assert(typeof module.scheduledTask === 'function', 'scheduled task action missing');
  },
  async 'system-codex-profile'() {
    await smokeAgentFactory('default');
    assert(registeredEvents.some((event) => event.eventName === 'session_before_compact'), 'codex profile compaction hooks missing');
    const target = join(cwd, 'smoke.txt');
    writeFileSync(target, 'hello\n');
    const result = await module.applyPatch({ patch: '*** Begin Patch\n*** Update File: smoke.txt\n@@\n-hello\n+hello smoke\n*** End Patch' }, ctx);
    assert(result.text.includes('updated: smoke.txt'), 'applyPatch did not update smoke file');
  },
  async 'system-code-mode'() {
    await smokeAgentFactory('default');
    const execCode = registeredTools.find((tool) => tool.name === 'exec_code');
    assert(execCode?.execute, 'exec_code tool was not registered');
    const start = registeredEvents.find((event) => event.eventName === 'session_start');
    assert(start?.handler, 'code mode session_start hook missing');
    activeTools = ['read', 'exec_code'];
    await start.handler({}, { ...ctx.agentToolContext, getActiveTools: pi.getActiveTools, setActiveTools: pi.setActiveTools });
    assert(JSON.stringify(activeTools) === JSON.stringify(['read']), 'code mode should not stay active by default');
    sessionEntries = [{ type: 'custom', customType: 'code-mode-state', data: { enabled: true } }];
    activeTools = ['read'];
    await start.handler({}, { ...ctx.agentToolContext, getActiveTools: pi.getActiveTools, setActiveTools: pi.setActiveTools });
    assert(JSON.stringify(activeTools) === JSON.stringify(['exec_code']), 'code mode did not hydrate from session metadata');
    const draftOn = await module.toggleCodeMode({ draft: true, action: 'on' }, ctx);
    assert(draftOn.enabled === true, 'code mode draft toggle did not enable');
    const draftState = await module.readState({ draft: true }, ctx);
    assert(draftState.enabled === true, 'code mode draft state did not persist');
    const consumedDraftState = await module.consumeDraftState({}, ctx);
    assert(consumedDraftState.enabled === true, 'code mode draft state did not consume enabled state');
    const draftAfterConsume = await module.readState({ draft: true }, ctx);
    assert(draftAfterConsume.enabled === false, 'code mode draft state was not cleared after consume');
    await module.toggleCodeMode({ conversationId: 'smoke-conversation', action: 'on' }, ctx);
    assert(JSON.stringify(activeTools) === JSON.stringify(['exec_code']), 'code mode did not replace active tools');
    assert(appendedEntries.some((entry) => entry.customType === 'code-mode-state'), 'code mode state was not persisted to session');
    const result = await execCode.execute('smoke', { code: 'return await listTools();' }, undefined, undefined, ctx.agentToolContext);
    assert(result?.content?.[0]?.text?.includes('read'), 'exec_code did not expose tool discovery');
  },
  async 'system-alleycat'() {
    const result = await module.status({}, ctx);
    assert(result.running === false, 'alleycat status should not auto-start service');
    assert(result.agents.length === 1 && result.agents[0].name === 'neon-pilot', 'alleycat should advertise only Neon Pilot');
  },
  async 'system-caffeinate'() {
    const before = await module.status({}, ctx);
    assert(before.running === false && before.pid === null, 'caffeinate should start stopped');
    const started = await module.start({}, ctx);
    assert(started.running === true && started.pid === 12345, 'caffeinate start failed');
    const stopped = await module.stop({}, ctx);
    assert(stopped.running === false && stopped.pid === null, 'caffeinate stop failed');
  },
  async 'system-browser'() {
    await smokeAgentFactory('createWorkbenchBrowserAgentExtension');
    const snapshot = registeredTools.find((tool) => tool.name === 'browser_snapshot');
    assert(snapshot?.execute, 'browser_snapshot tool was not registered');
    const result = await snapshot.execute('smoke', {}, undefined, undefined, ctx.agentToolContext);
    assert(result?.isError === true, 'browser_snapshot should report unavailable desktop host in smoke');
  },
  async 'system-conversation-tools'() {
    const result = await module.copyConversationId({ conversationId: 'smoke-conversation' }, ctx);
    assert(result.ok === true && result.conversationId === 'smoke-conversation', 'copyConversationId failed');
  },
  async 'system-context-hardening'() {
    await smokeAgentFactory('createContextHardeningAgentExtension');
    assert(registeredEvents.some((event) => event.eventName === 'message_end'), 'context hardening message_end hook missing');
    assert(
      registeredEvents.some((event) => event.eventName === 'before_provider_request'),
      'context hardening provider hook missing',
    );
  },
  async 'system-diffs'() {
    const result = await module.checkpoint({ action: 'list' }, ctx);
    assert(result.action === 'list', 'checkpoint list did not return list action');
  },
  async 'system-extension-manager'() {
    const result = await module.listHostViewComponents({}, ctx);
    assert(result.ok === true && Array.isArray(result.hostViewComponents), 'host component list failed');
  },
  async 'system-image-probe'() {
    await expectReject(() => module.probeImage({ imageIds: [], question: 'what is this?' }, ctx), /at least one image ID/i);
  },
  async 'system-video-probe'() {
    const result = await module.readSettings({}, ctx);
    assert(result.ok === true && result.settings && typeof result.settings.backend === 'string', 'readSettings failed');
  },
  async 'system-images'() {
    await expectReject(() => module.image({ prompt: 'draw smoke' }, { ...ctx, agentToolContext: undefined }), /active agent tool context/i);
  },
  async 'system-knowledge'() {
    const list = await module.knowledgeListFiles({}, ctx);
    assert(list.root === knowledgeRoot && Array.isArray(list.files), 'knowledgeListFiles failed');
    const refs = await module.resolvePromptReferences({ text: '@smoke.md' }, ctx);
    assert(Array.isArray(refs.contextBlocks), 'resolvePromptReferences failed');
  },
  async 'system-local-dictation'() {
    const result = await module.readSettings({}, ctx);
    assert(result && typeof result === 'object', 'readSettings failed');
  },
  async 'system-mcp'() {
    const result = await module.inspectMcpSettings({}, ctx);
    assert(Array.isArray(result.servers) && Array.isArray(result.searchedPaths), 'inspectMcpSettings failed');
  },
  async 'system-onboarding'() {
    const result = await module.ensure({}, ctx);
    assert(result.created === true && conversations.length === 1, 'onboarding ensure failed');
  },
  async 'system-prompt-assembly'() {
    const result = await module.inspectPromptAssembly({}, ctx);
    assert(result.ok === true && result.plan && Array.isArray(result.skills), 'prompt assembly inspect failed');
  },
  async 'system-runs'() {
    const result = await module.bash({ command: 'echo smoke' }, ctx);
    assert(result.text.includes('echo smoke'), 'bash smoke did not execute shell stub');
  },
  async 'system-self-preservation'() {
    await smokeAgentFactory('createSelfPreservationAgentExtension');
    const handler = registeredEvents.find((event) => event.eventName === 'tool_call')?.handler;
    assert(typeof handler === 'function', 'self preservation tool_call hook missing');
    const result = await handler({ toolName: 'bash', input: { command: 'kill ' + process.pid } });
    assert(result?.block === true, 'self preservation did not block agent PID kill');
  },
  async 'system-skills'() {
    const result = await module.listSkills({}, ctx);
    assert(result.ok === true && Array.isArray(result.skills), 'skills list failed');
  },
  async 'system-suggested-context'() {
    assert(typeof module.warmPointers === 'function', 'warmPointers action missing');
  },
  async 'system-telemetry'() {
    const result = await module.summary({ query: {} });
    assert(result.status === 200 && result.body, 'telemetry summary failed');
  },
  async 'system-todo'() {
    const empty = await module.getState({}, ctx);
    assert(Array.isArray(empty.items) && empty.items.length === 0, 'todo getState should start empty');
    const added = await module.addItem({ text: 'Smoke todo' }, ctx);
    assert(added.items.length === 1 && added.items[0].text === 'Smoke todo', 'todo addItem failed');
    const context = await module.provideTurnContext({}, ctx);
    assert(context.blocks?.[0]?.content?.includes('Smoke todo'), 'todo turn context missing open todo');
  },
  async 'system-web-tools'() {
    const result = await module.webFetch({ url: 'data:text/plain,smoke' }, ctx);
    assert(result.text.includes('smoke'), 'webFetch data URL failed');
  },
  async 'system-duckduckgo-search'() {
    globalThis.fetch = async () => ({
      ok: true,
      text: async () => '<html><body><a class="result__a" href="https://example.org/page">Example Title</a></body></html>',
    });
    const result = await module.duckDuckGoSearch({ query: 'smoke' }, ctx);
    assert(result.source === 'duckduckgo', 'duckDuckGoSearch failed');
  },
  async 'system-exa-search'() {
    const exaCtx = { ...ctx, secrets: { get: () => 'smoke-key' } };
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ results: [{ title: 'Exa Smoke', url: 'https://example.org/exa', text: 'smoke' }] }),
    });
    const result = await module.exaSearch({ query: 'smoke' }, exaCtx);
    assert(result.source === 'exa', 'exaSearch failed');
  },
};

const smoke = smokes[extensionId];
assert(smoke, 'No runtime smoke registered for ' + extensionId);
await smoke();
`;

function runBackendRuntimeSmoke(extensionId: string, backendPath: string) {
  try {
    execFileSync(
      process.execPath,
      ['--input-type=module', '--eval', BACKEND_ACTION_SMOKE_SCRIPT, extensionId, pathToFileURL(backendPath).href, process.cwd()],
      {
        encoding: 'utf-8',
        timeout: 30000,
        env: {
          ...process.env,
          NEON_PILOT_REPO_ROOT: process.cwd(),
          NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=1024`.trim(),
        },
      },
    );
  } catch (error) {
    const output = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : String(error);
    if (HOST_BACKED_EXTENSION_IDS.has(extensionId) && output.includes("Cannot find package '@neon-pilot/daemon'")) {
      return;
    }
    throw error;
  }
}

describe('system extension backend runtime smoke tests', () => {
  const systemBackends = listExtensionInstallSummaries()
    .filter(
      (summary) =>
        summary.packageType === 'system' &&
        summary.manifest.backend?.entry &&
        (summary.packageRoot ?? '').startsWith(resolve(process.cwd(), 'extensions/system-')),
    )
    .map((summary) => ({ id: summary.id, backendPath: resolve(summary.packageRoot ?? '', 'dist', 'backend.mjs') }))
    .sort((left, right) => left.id.localeCompare(right.id));

  it('has a smoke case for every system extension backend', () => {
    const smokeIds = new Set([...BACKEND_ACTION_SMOKE_SCRIPT.matchAll(/async '([^']+)'\(/g)].map((match) => match[1]));
    expect(
      systemBackends.map((backend) => backend.id).filter((id) => !smokeIds.has(id)),
      'Missing system extension backend runtime smoke cases',
    ).toEqual([]);
  });

  it('imports each prebuilt backend and exercises one safe runtime path', () => {
    for (const backend of systemBackends) {
      expect(existsSync(backend.backendPath), `${backend.id}: missing dist/backend.mjs`).toBe(true);
      expect(() => runBackendRuntimeSmoke(backend.id, backend.backendPath), `${backend.id}: backend runtime smoke failed`).not.toThrow();
    }
  }, 120000);
});
