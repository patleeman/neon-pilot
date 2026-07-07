import { afterEach, describe, expect, it, vi } from 'vitest';

const serverModuleMocks = vi.hoisted(() => ({
  permissions: ['agent:run', 'agent:conversations'] as string[],
  disableLiveSessionCreate: false,
  rejectNextAllowedToolLiveSessionCreate: false,
  liveSubscribers: [] as Array<(event: unknown) => void>,
  liveSessionCounter: 0,
  liveCreated: [] as Array<{ cwd: string; options: unknown }>,
  liveDestroyed: [] as string[],
  liveAborted: [] as string[],
  liveSubmitted: [] as Array<{ sessionId: string; text: string; images: unknown }>,
  liveResponses: [] as string[],
  toolInvocations: [] as Array<{ name: string; input: unknown; runtime: unknown }>,
  callServerModuleExport: vi.fn(async (specifier: string, exportName: string, ...args: unknown[]) => {
    if (specifier === '../../extensions/extensionPermissions.js' && exportName === 'assertExtensionPermission') {
      const [extensionId, permission, capability] = args as [string, string, string];
      if (!serverModuleMocks.permissions.includes(permission)) {
        throw new Error(`Extension "${extensionId}" requires permission ${permission} to use ${capability}.`);
      }
      return undefined;
    }
    if (specifier === '@neon-pilot/core' && exportName === 'getPiAgentRuntimeDir') return '/runtime';
    if (specifier === '@neon-pilot/core' && exportName === 'getRuntimeAuthFilePath') return '/runtime/auth.json';
    if (specifier === '../../conversations/liveSessions.js' && exportName === 'createSession') {
      if (serverModuleMocks.disableLiveSessionCreate) throw new Error('live sessions unavailable');
      const [cwd, options] = args as [string, unknown];
      if (
        serverModuleMocks.rejectNextAllowedToolLiveSessionCreate &&
        options &&
        typeof options === 'object' &&
        Array.isArray((options as { allowedToolNames?: unknown }).allowedToolNames)
      ) {
        serverModuleMocks.rejectNextAllowedToolLiveSessionCreate = false;
        throw new Error('Conversation "live-1" does not support active tool updates.');
      }
      const id = `live-${++serverModuleMocks.liveSessionCounter}`;
      serverModuleMocks.liveCreated.push({ cwd, options });
      return { id, sessionFile: `/tmp/${id}.jsonl` };
    }
    if (specifier === '../../conversations/liveSessions.js' && exportName === 'subscribe') {
      const [, listener] = args as [string, (event: unknown) => void];
      serverModuleMocks.liveSubscribers.push(listener);
      return () => {
        serverModuleMocks.liveSubscribers = serverModuleMocks.liveSubscribers.filter((candidate) => candidate !== listener);
      };
    }
    if (specifier === '../../conversations/liveSessions.js' && exportName === 'submitPromptSession') {
      const [sessionId, text, , images] = args as [string, string, unknown, unknown];
      serverModuleMocks.liveSubmitted.push({ sessionId, text, images });
      const response = serverModuleMocks.liveResponses.shift() ?? 'probe result';
      serverModuleMocks.liveSubscribers.forEach((listener) => listener({ type: 'text_delta', delta: response }));
      serverModuleMocks.liveSubscribers.forEach((listener) => listener({ type: 'agent_end' }));
      serverModuleMocks.liveSubscribers.forEach((listener) => listener({ type: 'turn_end' }));
      return { acceptedAs: 'started', completion: Promise.resolve() };
    }
    if (specifier === '../../conversations/liveSessions.js' && exportName === 'abortSession') {
      const [sessionId] = args as [string];
      serverModuleMocks.liveAborted.push(sessionId);
      return undefined;
    }
    if (specifier === '../../conversations/liveSessions.js' && exportName === 'destroySession') {
      const [sessionId] = args as [string];
      serverModuleMocks.liveDestroyed.push(sessionId);
      return undefined;
    }
    if (specifier === '../../tools/toolGateway.js' && exportName === 'invokeToolByName') {
      const [input] = args as [{ name: string; input: unknown }];
      serverModuleMocks.toolInvocations.push({ name: input.name, input: input.input, runtime: (input as { runtime?: unknown }).runtime });
      return { content: [{ type: 'text', text: `tool result for ${input.name}` }] };
    }
    throw new Error(`unexpected server module export: ${specifier}#${exportName}`);
  }),
  importServerModule: vi.fn(async (specifier: string) => {
    throw new Error(`unexpected server module import: ${specifier}`);
  }),
}));

vi.mock('./serverModuleResolver.js', () => ({
  callServerModuleExport: serverModuleMocks.callServerModuleExport,
  importServerModule: serverModuleMocks.importServerModule,
}));

import {
  abortAgentConversation,
  createAgentConversation,
  disposeAgentConversation,
  getAgentConversation,
  listAgentConversations,
  resetExtensionAgentDynamicImportForTests,
  runAgentTask,
  sendAgentMessage,
  setExtensionAgentDynamicImportForTests,
  streamAgentMessage,
} from './agent.js';

function createSession(overrides?: { prompt?: () => Promise<void>; messages?: unknown[]; emitText?: boolean }) {
  const subscribers: Array<(event: unknown) => void> = [];
  const session = {
    messages: overrides?.messages ?? [],
    subscribe: vi.fn((handler: (event: unknown) => void) => {
      subscribers.push(handler);
      return () => undefined;
    }),
    prompt: vi.fn(async () => {
      if (overrides?.prompt) return overrides.prompt();
      if (overrides?.emitText === false) return;
      const message = { role: 'assistant', content: [{ type: 'text', text: 'probe result' }] };
      session.messages.push(message);
      subscribers.forEach((handler) => handler({ type: 'message_end', message }));
    }),
    abort: vi.fn(),
    dispose: vi.fn(),
  };
  return session;
}

function installImporter(options?: { session?: ReturnType<typeof createSession>; permissions?: string[] }) {
  const session = options?.session ?? createSession();
  serverModuleMocks.permissions = options?.permissions ?? ['agent:run', 'agent:conversations'];
  const createAgentSession = vi.fn(async () => ({ session }));
  const authStorageCreate = vi.fn((path: string) => ({ path }));
  const modelRegistryCreate = vi.fn(() => ({ getAvailable: () => [{ provider: 'openai', id: 'fallback-model', input: ['text'] }] }));
  const sessionManagerInMemory = vi.fn((cwd: string) => ({ cwd }));
  const importer = vi.fn(async (specifier: string) => {
    if (specifier === '@earendil-works/pi-coding-agent') {
      return {
        createAgentSession,
        AuthStorage: { create: authStorageCreate },
        ModelRegistry: { create: modelRegistryCreate },
        SessionManager: { inMemory: sessionManagerInMemory },
      };
    }
    throw new Error(`unexpected import: ${specifier}`);
  });
  setExtensionAgentDynamicImportForTests(importer as never);
  return { authStorageCreate, createAgentSession, importer, modelRegistryCreate, session, sessionManagerInMemory };
}

function createCtx(overrides?: Record<string, unknown>) {
  const model = { provider: 'openai', id: 'gpt-vision', input: ['text', 'image'] };
  return {
    extensionId: 'system-image-probe',
    toolContext: { cwd: '/workspace' },
    agentToolContext: {
      cwd: '/agent-cwd',
      model,
      modelRegistry: {
        getAvailable: () => [model, { provider: 'openai', id: 'text-only', input: ['text'] }],
      },
    },
    ...overrides,
  } as never;
}

describe('extension agent backend API', () => {
  afterEach(() => {
    resetExtensionAgentDynamicImportForTests();
    serverModuleMocks.permissions = ['agent:run', 'agent:conversations'];
    serverModuleMocks.disableLiveSessionCreate = false;
    serverModuleMocks.rejectNextAllowedToolLiveSessionCreate = false;
    serverModuleMocks.liveSubscribers = [];
    serverModuleMocks.liveSessionCounter = 0;
    serverModuleMocks.liveCreated = [];
    serverModuleMocks.liveDestroyed = [];
    serverModuleMocks.liveAborted = [];
    serverModuleMocks.liveSubmitted = [];
    serverModuleMocks.liveResponses = [];
    serverModuleMocks.toolInvocations = [];
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('runs runAgentTask as create/send/dispose sugar', async () => {
    const { createAgentSession, session } = installImporter();

    const result = await runAgentTask(
      { prompt: 'Describe', modelRef: 'openai/gpt-vision', images: [{ type: 'image', data: 'abc', mimeType: 'image/png' }], tools: 'none' },
      createCtx(),
    );

    expect(result).toEqual({ text: 'probe result', model: 'gpt-vision', provider: 'openai' });
    expect(createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/workspace', noTools: 'all' }));
    expect(session.prompt).toHaveBeenCalledWith('Describe', { images: [{ type: 'image', data: 'abc', mimeType: 'image/png' }] });
    expect(session.dispose).toHaveBeenCalled();
  });

  it('defaults direct agent tasks to no tools when no allowlist is supplied', async () => {
    serverModuleMocks.disableLiveSessionCreate = true;
    const { createAgentSession } = installImporter();

    await expect(runAgentTask({ prompt: 'Describe' }, createCtx())).resolves.toMatchObject({ text: 'probe result' });

    expect(createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/workspace', noTools: 'all' }));
  });

  it('executes DS4 run_tool text calls for allowlisted hidden agent tasks', async () => {
    installImporter();
    serverModuleMocks.liveResponses = [
      '<｜｜DSML｜｜tool_calls> <｜｜DSML｜｜invoke name="run_tool"> <｜｜DSML｜｜parameter name="toolName" string="true">writing_studio_get_canvas</｜｜DSML｜｜parameter> <｜｜DSML｜｜parameter name="params" string="true">{"documentId":"doc-1"}</｜｜DSML｜｜parameter> </｜｜DSML｜｜invoke> </｜｜DSML｜｜tool_calls>',
      'done',
    ];

    const result = await runAgentTask(
      {
        prompt: 'Review',
        modelRef: 'ds4/deepseek-v4-flash',
        allowedToolNames: ['writing_studio_get_canvas'],
      },
      createCtx({ extensionId: 'system-writing-studio' }),
    );

    expect(result.text).toBe('done');
    expect(serverModuleMocks.toolInvocations).toEqual([
      {
        name: 'writing_studio_get_canvas',
        input: { documentId: 'doc-1' },
        runtime: { modelRef: 'ds4/deepseek-v4-flash', directToolNames: ['writing_studio_get_canvas'] },
      },
    ]);
    expect(serverModuleMocks.liveSubmitted).toEqual([
      { sessionId: 'live-1', text: 'Review', images: undefined },
      {
        sessionId: 'live-1',
        text: expect.stringContaining('Tool writing_studio_get_canvas result:'),
        images: undefined,
      },
    ]);
  });

  it('runs allowlisted hidden agent tasks with agent:run alone', async () => {
    installImporter({ permissions: ['agent:run'] });
    serverModuleMocks.liveResponses = ['done'];

    await expect(
      runAgentTask(
        {
          prompt: 'Review',
          modelRef: 'ds4/deepseek-v4-flash',
          allowedToolNames: ['writing_studio_get_canvas'],
        },
        createCtx({ extensionId: 'system-writing-studio' }),
      ),
    ).resolves.toMatchObject({ text: 'done' });

    expect(serverModuleMocks.liveCreated).toEqual([
      { cwd: '/workspace', options: { initialModel: 'ds4/deepseek-v4-flash', allowedToolNames: ['writing_studio_get_canvas'] } },
    ]);
    expect(serverModuleMocks.liveDestroyed).toEqual(['live-1']);
  });

  it('executes raw FunctionCalls invoke text for allowlisted hidden agent tasks', async () => {
    installImporter();
    serverModuleMocks.liveResponses = [
      '<FunctionCalls><Invoke name="writing_studio_add_annotation"><parameter name="quote" string="true">Hello</parameter><parameter name="body" string="true">Needs a sharper verb.</parameter></Invoke></FunctionCalls>',
      'annotated',
    ];

    const result = await runAgentTask(
      {
        prompt: 'Annotate',
        modelRef: 'ds4/deepseek-v4-flash',
        allowedToolNames: ['writing_studio_add_annotation'],
      },
      createCtx({ extensionId: 'system-writing-studio' }),
    );

    expect(result.text).toBe('annotated');
    expect(serverModuleMocks.toolInvocations).toEqual([
      {
        name: 'writing_studio_add_annotation',
        input: { quote: 'Hello', body: 'Needs a sharper verb.' },
        runtime: { modelRef: 'ds4/deepseek-v4-flash', directToolNames: ['writing_studio_add_annotation'] },
      },
    ]);
    expect(serverModuleMocks.liveSubmitted).toEqual([
      { sessionId: 'live-1', text: 'Annotate', images: undefined },
      {
        sessionId: 'live-1',
        text: expect.stringContaining('Tool writing_studio_add_annotation result:'),
        images: undefined,
      },
    ]);
  });

  it('retries allowlisted hidden agent tasks when active tool updates are unsupported', async () => {
    installImporter();
    serverModuleMocks.rejectNextAllowedToolLiveSessionCreate = true;
    serverModuleMocks.liveResponses = [
      '<FunctionCalls><Invoke name="writing_studio_add_annotation"><parameter name="quote" string="true">Hello</parameter><parameter name="body" string="true">Needs a sharper verb.</parameter></Invoke></FunctionCalls>',
      'annotated',
    ];

    const result = await runAgentTask(
      {
        prompt: 'Annotate',
        modelRef: 'ds4/deepseek-v4-flash',
        allowedToolNames: ['writing_studio_add_annotation'],
      },
      createCtx({ extensionId: 'system-writing-studio' }),
    );

    expect(result.text).toBe('annotated');
    const createAttempts = serverModuleMocks.callServerModuleExport.mock.calls.filter(
      ([specifier, exportName]) => specifier === '../../conversations/liveSessions.js' && exportName === 'createSession',
    );
    expect(createAttempts.map((call) => call[3])).toEqual([
      { initialModel: 'ds4/deepseek-v4-flash', allowedToolNames: ['writing_studio_add_annotation'] },
      { initialModel: 'ds4/deepseek-v4-flash', allowedToolNames: [] },
    ]);
    expect(serverModuleMocks.liveCreated).toEqual([
      { cwd: '/workspace', options: { initialModel: 'ds4/deepseek-v4-flash', allowedToolNames: [] } },
    ]);
    expect(serverModuleMocks.toolInvocations).toEqual([
      {
        name: 'writing_studio_add_annotation',
        input: { quote: 'Hello', body: 'Needs a sharper verb.' },
        runtime: { modelRef: 'ds4/deepseek-v4-flash', directToolNames: ['writing_studio_add_annotation'] },
      },
    ]);
  });

  it('keeps extension-owned hidden conversations for multiple live-session sends', async () => {
    const { createAgentSession, session } = installImporter();
    const ctx = createCtx();

    const created = await createAgentConversation({ title: 'Probe thread', tools: 'none' }, ctx);
    const first = await sendAgentMessage({ conversationId: created.id, text: 'first' }, ctx);
    const second = await sendAgentMessage({ conversationId: created.id, text: 'second' }, ctx);
    const listed = await listAgentConversations({}, ctx);
    const fetched = await getAgentConversation({ conversationId: created.id }, ctx);

    expect(first.text).toBe('probe result');
    expect(second.text).toBe('probe result');
    expect(createAgentSession).not.toHaveBeenCalled();
    expect(session.prompt).not.toHaveBeenCalled();
    expect(serverModuleMocks.liveCreated).toEqual([{ cwd: '/workspace', options: { allowedToolNames: [] } }]);
    expect(serverModuleMocks.liveSubmitted).toEqual([
      { sessionId: 'live-1', text: 'first', images: undefined },
      { sessionId: 'live-1', text: 'second', images: undefined },
    ]);
    expect(listed.map((item) => item.id)).toContain(created.id);
    expect(fetched).toMatchObject({
      id: created.id,
      ownerExtensionId: 'system-image-probe',
      visibility: 'hidden',
      persistence: 'ephemeral',
    });
  });

  it('streams hidden extension-owned conversation turns', async () => {
    const { session } = installImporter();
    const ctx = createCtx();
    const created = await createAgentConversation({ title: 'Streaming probe' }, ctx);

    const result = await streamAgentMessage({ conversationId: created.id, text: 'stream this' }, ctx);
    const events: unknown[] = [];
    for await (const event of result.events) {
      events.push(event.data);
    }

    expect(result.stream).toBe('sse');
    expect(events).toEqual([
      { type: 'user_message', text: 'stream this', ts: expect.any(String) },
      { type: 'agent_start' },
      { type: 'text_delta', delta: 'probe result' },
      { type: 'agent_end', text: 'probe result' },
      { type: 'turn_end' },
    ]);
    expect(session.prompt).not.toHaveBeenCalled();
    expect(serverModuleMocks.liveSubmitted).toEqual([{ sessionId: 'live-1', text: 'stream this', images: undefined }]);
  });

  it('streams final direct-session text after only empty deltas arrive', async () => {
    serverModuleMocks.disableLiveSessionCreate = true;
    const subscribers: Array<(event: unknown) => void> = [];
    const session = {
      messages: [],
      subscribe: vi.fn((handler: (event: unknown) => void) => {
        subscribers.push(handler);
        return () => undefined;
      }),
      prompt: vi.fn(async () => {
        const message = { role: 'assistant', content: [{ type: 'text', text: 'final direct text' }] };
        subscribers.forEach((handler) =>
          handler({ type: 'message_update', message: {}, assistantMessageEvent: { type: 'text_delta', delta: '' } }),
        );
        subscribers.forEach((handler) => handler({ type: 'message_end', message }));
      }),
      abort: vi.fn(),
      dispose: vi.fn(),
    };
    installImporter({ session: session as ReturnType<typeof createSession> });
    const ctx = createCtx();
    const created = await createAgentConversation({ title: 'Direct streaming', tools: 'none' }, ctx);

    const result = await streamAgentMessage({ conversationId: created.id, text: 'stream direct' }, ctx);
    const events: unknown[] = [];
    for await (const event of result.events) {
      events.push(event.data);
    }

    expect(events).toEqual([
      { type: 'user_message', text: 'stream direct', ts: expect.any(String) },
      { type: 'agent_start' },
      { type: 'text_delta', delta: 'final direct text' },
      { type: 'agent_end', text: 'final direct text' },
      { type: 'turn_end' },
    ]);
  });

  it('aborts hidden live-session agent conversations', async () => {
    const { session } = installImporter();
    const ctx = createCtx();
    const created = await createAgentConversation({ title: 'Abort hidden' }, ctx);

    const aborted = await abortAgentConversation({ conversationId: created.id }, ctx);

    expect(aborted).toMatchObject({ id: created.id, isBusy: false });
    expect(session.abort).not.toHaveBeenCalled();
    expect(serverModuleMocks.liveAborted).toEqual(['live-1']);
  });

  it('falls back to direct hidden sessions when live-session creation is unavailable', async () => {
    serverModuleMocks.disableLiveSessionCreate = true;
    const { createAgentSession, session } = installImporter();
    const ctx = createCtx();

    const created = await createAgentConversation({ title: 'Direct fallback', tools: 'none' }, ctx);
    const sent = await sendAgentMessage({ conversationId: created.id, text: 'fallback' }, ctx);

    expect(sent.text).toBe('probe result');
    expect(createAgentSession).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/workspace', noTools: 'all' }));
    expect(session.prompt).toHaveBeenCalledWith('fallback', undefined);
  });

  it('uses layout-derived runtime models path for direct fallback sessions', async () => {
    serverModuleMocks.disableLiveSessionCreate = true;
    const { modelRegistryCreate } = installImporter();
    const ctx = createCtx({
      agentToolContext: {
        cwd: '/agent-cwd',
        model: { provider: 'openai', id: 'fallback-model', input: ['text'] },
      },
      runtime: {
        getLiveSessionResourceOptions: () => ({
          additionalExtensionPaths: [],
          additionalSkillPaths: [],
          additionalPromptTemplatePaths: [],
          additionalThemePaths: [],
          modelsFilePath: '/desktop/system/runtime/models.json',
        }),
      },
    });

    await expect(createAgentConversation({ title: 'Direct fallback', tools: 'none' }, ctx)).resolves.toMatchObject({
      model: 'fallback-model',
    });

    expect(modelRegistryCreate).toHaveBeenCalledWith({ path: '/runtime/auth.json' }, '/desktop/system/runtime/models.json');
  });

  it('rejects streaming visible saved conversations because they use host live-session events', async () => {
    installImporter();
    const conversations = {
      create: vi.fn(async () => ({ id: 'visible-conversation' })),
      sendMessage: vi.fn(async () => ({ accepted: true })),
      getMeta: vi.fn(async () => ({})),
      list: vi.fn(async () => []),
    };
    const ctx = createCtx({ conversations });
    const created = await createAgentConversation({ visibility: 'visible', persistence: 'saved' }, ctx);

    await expect(streamAgentMessage({ conversationId: created.id, text: 'stream' }, ctx)).rejects.toThrow('host live-session events');
  });

  it('hides conversations from other extension owners', async () => {
    installImporter();
    const created = await createAgentConversation({ title: 'Private' }, createCtx());

    await expect(getAgentConversation({ conversationId: created.id }, createCtx({ extensionId: 'other-extension' }))).rejects.toThrow(
      'not found',
    );
  });

  it('delegates visible saved conversations to the host conversation capability', async () => {
    installImporter();
    const conversations = {
      create: vi.fn(async () => ({ id: 'visible-conversation' })),
      sendMessage: vi.fn(async () => ({ accepted: true })),
      getMeta: vi.fn(async () => ({
        id: 'visible-conversation',
        title: 'Visible title',
        cwd: '/visible-cwd',
        running: false,
        currentModel: 'gpt-vision',
      })),
      list: vi.fn(async () => []),
      abort: vi.fn(async () => ({ ok: true as const })),
    };
    const ctx = createCtx({ conversations });

    const created = await createAgentConversation(
      { title: 'Visible thread', cwd: '/visible-cwd', modelRef: 'openai/gpt-vision', visibility: 'visible', persistence: 'saved' },
      ctx,
    );
    const sent = await sendAgentMessage({ conversationId: created.id, text: 'keep going' }, ctx);
    const fetched = await getAgentConversation({ conversationId: created.id }, ctx);
    const aborted = await abortAgentConversation({ conversationId: created.id }, ctx);

    expect(created).toMatchObject({ id: 'visible-conversation', visibility: 'visible', persistence: 'saved' });
    expect(conversations.create).toHaveBeenCalledWith({ cwd: '/visible-cwd', model: 'openai/gpt-vision', allowedToolNames: [] });
    expect(conversations.sendMessage).toHaveBeenCalledWith('visible-conversation', 'keep going');
    expect(sent).toMatchObject({ id: 'visible-conversation', visibility: 'visible', persistence: 'saved' });
    expect(fetched).toMatchObject({ title: 'Visible title', cwd: '/visible-cwd', model: 'gpt-vision' });
    expect(conversations.abort).toHaveBeenCalledWith('visible-conversation');
    expect(aborted).toMatchObject({ id: 'visible-conversation', isBusy: false });
  });

  it('lists canonical host conversations alongside extension-local hidden handles', async () => {
    installImporter();
    const conversations = {
      create: vi.fn(async () => ({ id: 'visible-conversation' })),
      sendMessage: vi.fn(async () => ({ accepted: true })),
      getMeta: vi.fn(async () => ({})),
      list: vi.fn(async () => [
        {
          id: 'visible-conversation',
          title: 'Visible title',
          cwd: '/visible-cwd',
          currentModel: 'openai/gpt-4.1',
          isRunning: true,
          messageCount: 3,
          timestamp: '2026-06-01T00:00:00.000Z',
          lastActivityAt: '2026-06-01T00:01:00.000Z',
        },
      ]),
    };
    const ctx = createCtx({ conversations });
    const hidden = await createAgentConversation({ title: 'Hidden thread', tools: 'none' }, ctx);
    await createAgentConversation({ title: 'Visible thread', visibility: 'visible', persistence: 'saved' }, ctx);

    const listed = await listAgentConversations({}, ctx);

    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'visible-conversation', visibility: 'visible', persistence: 'saved', isBusy: true }),
        expect.objectContaining({ id: hidden.id, visibility: 'hidden', persistence: 'ephemeral' }),
      ]),
    );
    expect(listed.find((item) => item.id === 'visible-conversation')).toMatchObject({
      title: 'Visible title',
      cwd: '/visible-cwd',
      visibility: 'visible',
      persistence: 'saved',
    });
  });

  it('rejects mixed visibility and persistence modes', async () => {
    installImporter();

    await expect(createAgentConversation({ visibility: 'visible', persistence: 'ephemeral' }, createCtx())).rejects.toThrow(
      'hidden+ephemeral or visible+saved',
    );
    await expect(createAgentConversation({ visibility: 'hidden', persistence: 'saved' }, createCtx())).rejects.toThrow(
      'hidden+ephemeral or visible+saved',
    );
  });

  it('falls back to session messages when no message_end event emits text', async () => {
    installImporter({
      session: createSession({ emitText: false, messages: [{ role: 'assistant', content: [{ type: 'text', text: 'from messages' }] }] }),
    });

    await expect(runAgentTask({ prompt: 'Describe' }, createCtx())).resolves.toMatchObject({ text: 'from messages' });
  });

  it('rejects image input for text-only models', async () => {
    installImporter();

    await expect(
      runAgentTask(
        { prompt: 'Describe', modelRef: 'text-only', images: [{ type: 'image', data: 'abc', mimeType: 'image/png' }] },
        createCtx(),
      ),
    ).rejects.toThrow('does not accept images');
  });

  it('requires agent:conversations permission for retained sessions', async () => {
    installImporter({ permissions: ['agent:run'] });

    await expect(createAgentConversation({ title: 'Denied' }, createCtx())).rejects.toThrow('requires permission agent:conversations');
  });

  it('disposes retained sessions explicitly', async () => {
    const { session } = installImporter();
    const created = await createAgentConversation({ title: 'Dispose me' }, createCtx());

    await expect(disposeAgentConversation({ conversationId: created.id }, createCtx())).resolves.toEqual({
      ok: true,
      conversationId: created.id,
    });
    expect(session.dispose).not.toHaveBeenCalled();
    expect(serverModuleMocks.liveDestroyed).toEqual(['live-1']);
    await expect(getAgentConversation({ conversationId: created.id }, createCtx())).rejects.toThrow('not found');
  });

  it('aborts and disposes the session when a task times out', async () => {
    const session = createSession({ prompt: () => new Promise(() => undefined) });
    installImporter({ session });

    await expect(runAgentTask({ prompt: 'Describe', timeoutMs: 1 }, createCtx())).rejects.toThrow('timed out after 1ms');
    expect(session.abort).toHaveBeenCalled();
    expect(session.dispose).toHaveBeenCalled();
  });
});
