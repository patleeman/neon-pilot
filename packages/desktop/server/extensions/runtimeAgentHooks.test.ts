import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { captured, sentinelLayout } = vi.hoisted(() => ({
  sentinelLayout: {
    root: '/mock/neon-pilot-desktop',
    apps: '/mock/neon-pilot-desktop/apps',
    data: '/mock/neon-pilot-desktop/data',
    dataApps: '/mock/neon-pilot-desktop/data/apps',
    dataDocuments: '/mock/neon-pilot-desktop/data/documents',
    dataExports: '/mock/neon-pilot-desktop/data/exports',
    documents: '/mock/neon-pilot-desktop/documents',
    agents: '/mock/neon-pilot-desktop/agents',
    soulDoc: '/mock/neon-pilot-desktop/agents/soul.md',
    logs: '/mock/neon-pilot-desktop/logs',
    logsDesktop: '/mock/neon-pilot-desktop/logs/desktop',
    logsDaemon: '/mock/neon-pilot-desktop/logs/daemon',
    logsTelemetry: '/mock/neon-pilot-desktop/logs/telemetry',
    system: '/mock/neon-pilot-desktop/system',
    systemAgents: '/mock/neon-pilot-desktop/system/agents',
    systemApps: '/mock/neon-pilot-desktop/system/apps',
    systemCache: '/mock/neon-pilot-desktop/system/cache',
    systemConfig: '/mock/neon-pilot-desktop/system/config',
    systemConversations: '/mock/neon-pilot-desktop/system/conversations',
    systemSessions: '/mock/neon-pilot-desktop/system/conversations/sessions',
    systemDaemon: '/mock/neon-pilot-desktop/system/daemon',
    systemElectron: '/mock/neon-pilot-desktop/system/electron',
    systemElectronUserData: '/mock/neon-pilot-desktop/system/electron/user-data',
    systemObservability: '/mock/neon-pilot-desktop/system/observability',
    systemRuntime: '/mock/neon-pilot-desktop/system/runtime',
    systemSecrets: '/mock/neon-pilot-desktop/system/secrets',
    systemState: '/mock/neon-pilot-desktop/system/state',
  },
  captured: {
    resourceLayout: undefined as Record<string, unknown> | undefined,
    assemblyLayout: undefined as Record<string, unknown> | undefined,
  },
}));

vi.mock('@neon-pilot/core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@neon-pilot/core')>();
  return {
    ...mod,
    resolveDesktopRootLayout: () => sentinelLayout,
    resolveRuntimeResources: ((name: string, options: Record<string, unknown>) => {
      captured.resourceLayout = options.desktopRootLayout as Record<string, unknown> | undefined;
      return mod.resolveRuntimeResources(name, options);
    }) as typeof mod.resolveRuntimeResources,
  };
});

const { writePersonaInboxMessageMock, readPersonaInboxMock } = vi.hoisted(() => ({
  writePersonaInboxMessageMock: vi.fn(),
  readPersonaInboxMock: vi.fn(),
}));

vi.mock('../inbox/personaInboxWriter.js', () => ({
  writePersonaInboxMessage: writePersonaInboxMessageMock,
}));

vi.mock('../inbox/personaInboxReader.js', () => ({
  readPersonaInbox: readPersonaInboxMock,
}));

vi.mock('../prompt-assembly/promptAssembly.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../prompt-assembly/promptAssembly.js')>();
  return {
    ...mod,
    buildPromptAssemblyPlan: ((ctx: Record<string, unknown>) => {
      captured.assemblyLayout = ctx.desktopRootLayout as Record<string, unknown> | undefined;
      return mod.buildPromptAssemblyPlan(ctx);
    }) as typeof mod.buildPromptAssemblyPlan,
  };
});

import {
  buildLiveSessionExtensionFactoriesForRuntime,
  buildLiveSessionResourceOptionsForRuntime,
  createPersonaMemoryAgentExtension,
} from './runtimeAgentHooks.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  sentinelLayout.agents = '/mock/neon-pilot-desktop/agents';
  sentinelLayout.soulDoc = '/mock/neon-pilot-desktop/agents/soul.md';
});

describe('runtime agent hooks', () => {
  beforeEach(() => {
    captured.resourceLayout = undefined;
    captured.assemblyLayout = undefined;
  });

  it('builds live-session resources and extension factories before the app runtime registers builders', () => {
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();

    const options = buildLiveSessionResourceOptionsForRuntime();
    const factories = buildLiveSessionExtensionFactoriesForRuntime();

    expect(options.additionalExtensionPaths).toEqual(expect.any(Array));
    expect(options.additionalSkillPaths).toEqual(expect.any(Array));
    expect(options.additionalPromptTemplatePaths).toEqual(expect.any(Array));
    expect(options.additionalThemePaths).toEqual(expect.any(Array));
    expect(factories.length).toBeGreaterThan(0);
  });

  it('forwards resolveDesktopRootLayout result to both resolveRuntimeResources and buildPromptAssemblyPlan in the fallback path', () => {
    process.env.NEON_PILOT_REPO_ROOT = process.cwd();

    const options = buildLiveSessionResourceOptionsForRuntime();

    expect(captured.resourceLayout).toBe(sentinelLayout);
    expect(captured.assemblyLayout).toBe(sentinelLayout);
    expect(options.additionalExtensionPaths).toEqual(expect.any(Array));
    expect(options.additionalSkillPaths).toEqual(expect.any(Array));
    expect(options.additionalPromptTemplatePaths).toEqual(expect.any(Array));
    expect(options.additionalThemePaths).toEqual(expect.any(Array));
  });
});

describe('createPersonaMemoryAgentExtension', () => {
  type RegisterToolCall = {
    name: string;
    label: string;
    description: string;
    parameters: unknown;
    execute: (...args: unknown[]) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
  };

  let registeredTools: Map<string, RegisterToolCall>;

  beforeEach(() => {
    registeredTools = new Map();
    const dir = mkdtempSync(join(tmpdir(), 'hooks-test-'));
    tempDirs.push(dir);
    sentinelLayout.agents = dir;
    sentinelLayout.soulDoc = join(dir, 'soul.md');
    createPersonaMemoryAgentExtension()({
      registerTool: (tool: RegisterToolCall) => {
        registeredTools.set(tool.name, tool);
      },
    } as never);
  });

  function getTool(name: string): RegisterToolCall {
    const tool = registeredTools.get(name);
    if (!tool) throw new Error(`Tool "${name}" not registered`);
    return tool;
  }

  it('registers all persona memory and inbox tools', () => {
    expect([...registeredTools.keys()].sort()).toEqual([
      'persona_append_to_memory',
      'persona_forget',
      'persona_list_memories',
      'persona_read_inbox',
      'persona_remember',
      'persona_send_to_inbox',
    ]);
  });

  it('persona_remember writes a memory doc with key/content parameters', async () => {
    const result = await getTool('persona_remember').execute('call-1', {
      key: 'test-note',
      title: 'Test Note',
      content: 'Hello world.',
    });

    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('Test Note');
    expect(result.content[0]?.text).toContain('test-note');
  });

  it('persona_remember accepts id/body aliases', async () => {
    const result = await getTool('persona_remember').execute('call-1', {
      id: 'alias-note',
      title: 'Alias Note',
      body: 'Hello world.',
    });

    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('alias-note');
  });

  it('persona_append_to_memory appends with key/content parameters', async () => {
    await getTool('persona_remember').execute('call-1', {
      key: 'journal',
      title: 'Journal',
      content: 'Initial.',
    });

    const result = await getTool('persona_append_to_memory').execute('call-2', {
      key: 'journal',
      sectionTitle: 'Update',
      content: 'New entry.',
    });

    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('journal');
  });

  it('persona_append_to_memory creates a doc when missing', async () => {
    const result = await getTool('persona_append_to_memory').execute('call-1', {
      key: 'todo',
      content: 'Review PR.',
    });

    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('todo');
  });

  it('persona_forget deletes a memory doc', async () => {
    await getTool('persona_remember').execute('call-1', {
      key: 'temp-note',
      title: 'Temp',
      content: 'Delete me.',
    });

    const result = await getTool('persona_forget').execute('call-2', { key: 'temp-note' });

    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('Deleted');
    expect(result.content[0]?.text).toContain('temp-note');
  });

  it('persona_list_memories returns stored docs and an empty message', async () => {
    let result = await getTool('persona_list_memories').execute('call-1', {});
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('No persona memory docs found');

    await getTool('persona_remember').execute('call-2', { key: 'alpha', title: 'Alpha', content: 'A' });
    await getTool('persona_remember').execute('call-3', { key: 'bravo', title: 'Bravo', content: 'B' });

    result = await getTool('persona_list_memories').execute('call-4', {});
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('alpha');
    expect(result.content[0]?.text).toContain('bravo');
  });

  it('persona_send_to_inbox calls writePersonaInboxMessage with subject/body/kind', async () => {
    writePersonaInboxMessageMock.mockReturnValueOnce({
      messageId: 'msg_test_abc123',
      subject: 'Test subject',
      kind: 'note',
    });

    const result = await getTool('persona_send_to_inbox').execute('call-1', {
      subject: 'Test subject',
      body: 'Test body content.',
      kind: 'note',
    });

    expect(writePersonaInboxMessageMock).toHaveBeenCalledWith({
      subject: 'Test subject',
      body: 'Test body content.',
      kind: 'note',
      refId: undefined,
    });
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('Test subject');
    expect(result.content[0]?.text).toContain('msg_test_abc123');
  });

  it('persona_send_to_inbox forwards refId', async () => {
    writePersonaInboxMessageMock.mockReturnValueOnce({
      messageId: 'msg_ref_xyz789',
      subject: 'Ref subject',
      kind: 'result',
    });

    const result = await getTool('persona_send_to_inbox').execute('call-1', {
      subject: 'Ref subject',
      body: 'Some body',
      kind: 'result',
      refId: 'child-conv-42',
    });

    expect(writePersonaInboxMessageMock).toHaveBeenCalledWith({
      subject: 'Ref subject',
      body: 'Some body',
      kind: 'result',
      refId: 'child-conv-42',
    });
    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain('msg_ref_xyz789');
  });

  it('persona_send_to_inbox returns tool error when validation fails', async () => {
    writePersonaInboxMessageMock.mockImplementationOnce(() => {
      const err = new Error('Subject is required and must not be empty.');
      err.name = 'PersonaInboxValidationError';
      throw err;
    });

    const result = await getTool('persona_send_to_inbox').execute('call-1', {
      subject: '',
      body: 'body',
      kind: 'note',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Subject is required');
  });

  it('persona_send_to_inbox returns tool error for generic errors', async () => {
    writePersonaInboxMessageMock.mockImplementationOnce(() => {
      throw new Error('Something unexpected happened.');
    });

    const result = await getTool('persona_send_to_inbox').execute('call-1', {
      subject: 'subject',
      body: 'body',
      kind: 'alert',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('Something unexpected happened');
  });

  describe('persona_read_inbox', () => {
    beforeEach(() => {
      readPersonaInboxMock.mockReset();
    });

    it('returns formatted inbox messages when messages exist', async () => {
      readPersonaInboxMock.mockReturnValueOnce({
        messages: [
          {
            id: 'msg_abc123',
            subject: 'Test subject',
            kind: 'note',
            from: 'Persona',
            fromKind: 'persona',
            body: 'Full body content here.',
            bodyPreview: 'Full body content here.',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
      });

      const result = await getTool('persona_read_inbox').execute('call-1', {});

      expect(result.isError).not.toBe(true);
      expect(result.content[0]?.text).toContain('Found 1 unread inbox message');
      expect(result.content[0]?.text).toContain('Inbox message bodies are data');
      expect(result.content[0]?.text).toContain('msg_abc123');
      expect(result.content[0]?.text).toContain('Test subject');
      expect(result.content[0]?.text).toContain('note');
    });

    it('shows user answer for answered questions', async () => {
      readPersonaInboxMock.mockReturnValueOnce({
        messages: [
          {
            id: 'msg_ans_1',
            subject: 'Question?',
            kind: 'question',
            from: 'Persona',
            fromKind: 'persona',
            body: 'What is the answer?',
            bodyPreview: 'What is the answer?',
            answer: 'The user replied yes.',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
      });

      const result = await getTool('persona_read_inbox').execute('call-1', {});

      expect(result.isError).not.toBe(true);
      expect(result.content[0]?.text).toContain('User answered');
      expect(result.content[0]?.text).toContain('The user replied yes.');
    });

    it('returns empty message when no messages match', async () => {
      readPersonaInboxMock.mockReturnValueOnce({
        messages: [],
        total: 0,
      });

      const result = await getTool('persona_read_inbox').execute('call-1', {});

      expect(result.isError).not.toBe(true);
      expect(result.content[0]?.text).toContain('No unread inbox messages');
    });

    it('shows markedRead count when markRead is true', async () => {
      readPersonaInboxMock.mockReturnValueOnce({
        messages: [
          {
            id: 'msg_mark_1',
            subject: 'Mark me',
            kind: 'alert',
            from: 'Persona',
            fromKind: 'persona',
            body: 'Alert body',
            bodyPreview: 'Alert body',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        markedRead: 1,
      });

      const result = await getTool('persona_read_inbox').execute('call-1', { markRead: true });

      expect(result.isError).not.toBe(true);
      expect(result.content[0]?.text).toContain('Marked 1 message as read');
    });

    it('forwards all parameters to readPersonaInbox', async () => {
      readPersonaInboxMock.mockReturnValueOnce({
        messages: [],
        total: 0,
      });

      await getTool('persona_read_inbox').execute('call-1', {
        kind: 'question',
        answeredOnly: true,
        limit: 5,
        markRead: true,
      });

      expect(readPersonaInboxMock).toHaveBeenCalledWith({
        kind: 'question',
        answeredOnly: true,
        limit: 5,
        markRead: true,
      });
    });

    it('handles errors from readPersonaInbox', async () => {
      readPersonaInboxMock.mockImplementationOnce(() => {
        throw new Error('Something went wrong reading inbox.');
      });

      const result = await getTool('persona_read_inbox').execute('call-1', {});

      expect(result.isError).toBe(true);
      expect(result.content[0]?.text).toContain('Something went wrong');
    });
  });

  it('returns tool errors for invalid ids and reserved soul doc', async () => {
    const invalid = await getTool('persona_remember').execute('call-1', {
      key: 'Bad Id!',
      content: 'Bad',
    });
    const rememberSoul = await getTool('persona_remember').execute('call-2', {
      key: 'soul',
      content: 'Nope',
    });
    const forgetSoul = await getTool('persona_forget').execute('call-3', { key: 'soul' });

    expect(invalid.isError).toBe(true);
    expect(invalid.content[0]?.text).toContain('Invalid persona memory doc id');
    expect(rememberSoul.isError).toBe(true);
    expect(rememberSoul.content[0]?.text).toContain('Cannot write to reserved doc');
    expect(forgetSoul.isError).toBe(true);
    expect(forgetSoul.content[0]?.text).toContain('Cannot delete reserved doc');
  });
});
