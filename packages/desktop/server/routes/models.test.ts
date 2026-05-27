import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cancelProviderOAuthLoginMock,
  getAvailableModelsMock,
  getMachineConfigFilePathMock,
  getProviderOAuthLoginStateMock,
  readMachineInstructionFilesMock,
  readMachineSkillDirsMock,
  readMachineSystemPromptTemplateMock,
  invalidateAppTopicsMock,
  logErrorMock,
  normalizeSavedModelPreferencesMock,
  persistSettingsWriteMock,
  readModelProvidersStateMock,
  readProviderAuthStateMock,
  readSavedDefaultCwdPreferencesMock,
  readSavedModelPreferencesMock,
  refreshAllLiveSessionModelRegistriesMock,
  reloadAllLiveSessionAuthMock,
  removeModelProviderMock,
  removeModelProviderModelMock,
  removeProviderCredentialMock,
  setProviderApiKeyMock,
  startProviderOAuthLoginMock,
  submitProviderOAuthLoginInputMock,
  subscribeProviderOAuthLoginMock,
  upsertModelProviderMock,
  writeMachineInstructionFilesMock,
  writeMachineSkillDirsMock,
  writeMachineSystemPromptTemplateMock,
  upsertModelProviderModelMock,
  writeSavedDefaultCwdPreferenceMock,
  writeSavedModelPreferencesMock,
} = vi.hoisted(() => ({
  cancelProviderOAuthLoginMock: vi.fn(),
  getAvailableModelsMock: vi.fn(),
  getMachineConfigFilePathMock: vi.fn(),
  getProviderOAuthLoginStateMock: vi.fn(),
  readMachineInstructionFilesMock: vi.fn(),
  readMachineSkillDirsMock: vi.fn(),
  readMachineSystemPromptTemplateMock: vi.fn(),
  invalidateAppTopicsMock: vi.fn(),
  logErrorMock: vi.fn(),
  normalizeSavedModelPreferencesMock: vi.fn(),
  persistSettingsWriteMock: vi.fn(),
  readModelProvidersStateMock: vi.fn(),
  readProviderAuthStateMock: vi.fn(),
  readSavedDefaultCwdPreferencesMock: vi.fn(),
  readSavedModelPreferencesMock: vi.fn(),
  refreshAllLiveSessionModelRegistriesMock: vi.fn(),
  reloadAllLiveSessionAuthMock: vi.fn(),
  removeModelProviderMock: vi.fn(),
  removeModelProviderModelMock: vi.fn(),
  removeProviderCredentialMock: vi.fn(),
  setProviderApiKeyMock: vi.fn(),
  startProviderOAuthLoginMock: vi.fn(),
  submitProviderOAuthLoginInputMock: vi.fn(),
  subscribeProviderOAuthLoginMock: vi.fn(),
  upsertModelProviderMock: vi.fn(),
  writeMachineInstructionFilesMock: vi.fn(),
  writeMachineSkillDirsMock: vi.fn(),
  writeMachineSystemPromptTemplateMock: vi.fn(),
  upsertModelProviderModelMock: vi.fn(),
  writeSavedDefaultCwdPreferenceMock: vi.fn(),
  writeSavedModelPreferencesMock: vi.fn(),
}));

vi.mock('@neon-pilot/core', () => ({
  getMachineConfigFilePath: getMachineConfigFilePathMock,
  getStateRoot: vi.fn(() => '/state-root'),
  readMachineInstructionFiles: readMachineInstructionFilesMock,
  readMachineSkillDirs: readMachineSkillDirsMock,
  readMachineSystemPromptTemplate: readMachineSystemPromptTemplateMock,
  writeMachineInstructionFiles: writeMachineInstructionFilesMock,
  writeMachineSkillDirs: writeMachineSkillDirsMock,
  writeMachineSystemPromptTemplate: writeMachineSystemPromptTemplateMock,
}));

vi.mock('../models/modelPreferences.js', () => ({
  normalizeSavedModelPreferences: normalizeSavedModelPreferencesMock,
  readSavedModelPreferences: readSavedModelPreferencesMock,
  writeSavedModelPreferences: writeSavedModelPreferencesMock,
}));

vi.mock('../models/modelProviders.js', () => ({
  readModelProvidersState: readModelProvidersStateMock,
  removeModelProvider: removeModelProviderMock,
  removeModelProviderModel: removeModelProviderModelMock,
  upsertModelProvider: upsertModelProviderMock,
  upsertModelProviderModel: upsertModelProviderModelMock,
}));

vi.mock('../models/providerAuth.js', () => ({
  cancelProviderOAuthLogin: cancelProviderOAuthLoginMock,
  getProviderOAuthLoginState: getProviderOAuthLoginStateMock,
  readProviderAuthState: readProviderAuthStateMock,
  removeProviderCredential: removeProviderCredentialMock,
  setProviderApiKey: setProviderApiKeyMock,
  startProviderOAuthLogin: startProviderOAuthLoginMock,
  submitProviderOAuthLoginInput: submitProviderOAuthLoginInputMock,
  subscribeProviderOAuthLogin: subscribeProviderOAuthLoginMock,
}));

vi.mock('../ui/defaultCwdPreferences.js', () => ({
  readSavedDefaultCwdPreferences: readSavedDefaultCwdPreferencesMock,
  writeSavedDefaultCwdPreference: writeSavedDefaultCwdPreferenceMock,
}));

vi.mock('../conversations/liveSessions.js', () => ({
  getAvailableModels: getAvailableModelsMock,
}));

vi.mock('../middleware/index.js', () => ({
  invalidateAppTopics: invalidateAppTopicsMock,
  logError: logErrorMock,
  persistSettingsWrite: persistSettingsWriteMock,
  reloadAllLiveSessionAuth: reloadAllLiveSessionAuthMock,
  refreshAllLiveSessionModelRegistries: refreshAllLiveSessionModelRegistriesMock,
}));

import { registerModelRoutes } from './models.js';

type Handler = (req: unknown, res: unknown) => Promise<void> | void;

type RouteFiles = {
  root: string;
  authFile: string;
  settingsFile: string;
  profileSettingsFile: string;
};

function createRouteFiles(): RouteFiles {
  const root = mkdtempSync(join(tmpdir(), 'pa-model-routes-'));
  return {
    root,
    authFile: join(root, 'auth.json'),
    settingsFile: join(root, 'runtime-settings.json'),
    profileSettingsFile: join(root, 'profile-settings.json'),
  };
}

function cleanupRouteFiles(files: RouteFiles): void {
  rmSync(files.root, { recursive: true, force: true });
}

function createRequest(overrides: Record<string, unknown> = {}) {
  const listeners = new Map<string, Array<() => void>>();
  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    on: vi.fn((event: string, listener: () => void) => {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
    }),
    emit(event: string) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
    ...overrides,
  };

  return req;
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, unknown>,
    end: vi.fn(),
    flushHeaders: vi.fn(),
    json: vi.fn((payload: unknown) => {
      response.body = payload;
      return response;
    }),
    setHeader: vi.fn((name: string, value: unknown) => {
      response.headers[name] = value;
    }),
    status: vi.fn((code: number) => {
      response.statusCode = code;
      return response;
    }),
    write: vi.fn(),
  };

  return response;
}

function createDesktopHarness(files = createRouteFiles()) {
  const deleteHandlers = new Map<string, Handler>();
  const getHandlers = new Map<string, Handler>();
  const patchHandlers = new Map<string, Handler>();
  const postHandlers = new Map<string, Handler>();
  const materializeWebRuntimeConfig = vi.fn();

  const router = {
    delete: vi.fn((path: string, handler: Handler) => {
      deleteHandlers.set(path, handler);
    }),
    get: vi.fn((path: string, handler: Handler) => {
      getHandlers.set(path, handler);
    }),
    patch: vi.fn((path: string, handler: Handler) => {
      patchHandlers.set(path, handler);
    }),
    post: vi.fn((path: string, handler: Handler) => {
      postHandlers.set(path, handler);
    }),
  };

  registerModelRoutes(router as never, {
    getAuthFile: () => files.authFile,
    getRuntimeScope: () => 'shared',
    getSettingsFile: () => files.settingsFile,
    materializeWebRuntimeConfig,
  });

  return {
    files,
    materializeWebRuntimeConfig,
    deleteHandler: (path: string) => deleteHandlers.get(path)!,
    getHandler: (path: string) => getHandlers.get(path)!,
    patchHandler: (path: string) => patchHandlers.get(path)!,
    postHandler: (path: string) => postHandlers.get(path)!,
  };
}

describe('model routes', () => {
  const allocatedFiles: RouteFiles[] = [];
  let machineConfig: Record<string, unknown>;

  beforeEach(() => {
    machineConfig = {};

    cancelProviderOAuthLoginMock.mockReset();
    getAvailableModelsMock.mockReset();
    getMachineConfigFilePathMock.mockReset();
    getProviderOAuthLoginStateMock.mockReset();
    readMachineInstructionFilesMock.mockReset();
    readMachineSkillDirsMock.mockReset();
    readMachineSystemPromptTemplateMock.mockReset();
    invalidateAppTopicsMock.mockReset();
    logErrorMock.mockReset();
    normalizeSavedModelPreferencesMock.mockReset();
    persistSettingsWriteMock.mockReset();
    readModelProvidersStateMock.mockReset();
    readProviderAuthStateMock.mockReset();
    readSavedDefaultCwdPreferencesMock.mockReset();
    readSavedModelPreferencesMock.mockReset();
    refreshAllLiveSessionModelRegistriesMock.mockReset();
    reloadAllLiveSessionAuthMock.mockReset();
    removeModelProviderMock.mockReset();
    removeModelProviderModelMock.mockReset();
    removeProviderCredentialMock.mockReset();
    setProviderApiKeyMock.mockReset();
    startProviderOAuthLoginMock.mockReset();
    submitProviderOAuthLoginInputMock.mockReset();
    subscribeProviderOAuthLoginMock.mockReset();
    upsertModelProviderMock.mockReset();
    upsertModelProviderModelMock.mockReset();
    writeMachineInstructionFilesMock.mockReset();
    writeMachineSkillDirsMock.mockReset();
    writeMachineSystemPromptTemplateMock.mockReset();
    writeSavedDefaultCwdPreferenceMock.mockReset();
    writeSavedModelPreferencesMock.mockReset();

    getAvailableModelsMock.mockReturnValue([
      {
        id: 'model-a',
        provider: 'provider-a',
        name: 'Model A',
        contextWindow: 128_000,
        api: 'anthropic-messages',
      },
    ]);
    getMachineConfigFilePathMock.mockReturnValue('/config/config.json');
    getProviderOAuthLoginStateMock.mockReturnValue({ id: 'login-1', status: 'pending' });
    readMachineInstructionFilesMock.mockImplementation(() => [...((machineConfig.instructionFiles as string[] | undefined) ?? [])]);
    readMachineSkillDirsMock.mockImplementation(() => [...((machineConfig.skillDirs as string[] | undefined) ?? [])]);
    readMachineSystemPromptTemplateMock.mockImplementation(
      () => (machineConfig.systemPromptTemplate as string | undefined) ?? '# Defaults\n',
    );
    writeMachineSystemPromptTemplateMock.mockImplementation((template: string) => {
      machineConfig.systemPromptTemplate = template;
      return machineConfig;
    });
    normalizeSavedModelPreferencesMock.mockReturnValue({
      currentModel: 'model-a',
      currentThinkingLevel: 'high',
      currentServiceTier: '',
    });
    persistSettingsWriteMock.mockImplementation((write: (settingsFile: string) => unknown, options: { runtimeSettingsFile: string }) =>
      write(options.runtimeSettingsFile),
    );
    readModelProvidersStateMock.mockReturnValue({ providers: [] });
    readProviderAuthStateMock.mockReturnValue({ providers: [] });
    readSavedDefaultCwdPreferencesMock.mockReturnValue({ cwd: '/repo' });
    readSavedModelPreferencesMock.mockReturnValue({ currentModel: 'model-a', currentThinkingLevel: 'high', currentServiceTier: '' });
    setProviderApiKeyMock.mockReturnValue({ providers: [{ id: 'openai' }] });
    startProviderOAuthLoginMock.mockReturnValue({ id: 'login-1', status: 'pending' });
    submitProviderOAuthLoginInputMock.mockReturnValue({ id: 'login-1', status: 'waiting_input' });
    subscribeProviderOAuthLoginMock.mockImplementation(() => vi.fn());
    writeMachineInstructionFilesMock.mockImplementation((instructionFiles: string[]) => {
      machineConfig =
        instructionFiles.length > 0
          ? { ...machineConfig, instructionFiles: [...instructionFiles] }
          : (() => {
              const next = { ...machineConfig };
              delete next.instructionFiles;
              return next;
            })();
      return machineConfig;
    });
    writeMachineSkillDirsMock.mockImplementation((skillDirs: string[]) => {
      machineConfig =
        skillDirs.length > 0
          ? { ...machineConfig, skillDirs: [...skillDirs] }
          : (() => {
              const next = { ...machineConfig };
              delete next.skillDirs;
              return next;
            })();
      return machineConfig;
    });
    upsertModelProviderMock.mockReturnValue({ providers: [{ id: 'openrouter' }] });
    upsertModelProviderModelMock.mockReturnValue({ providers: [{ id: 'openrouter', models: [{ id: 'model-b' }] }] });
    removeModelProviderMock.mockReturnValue({ state: { providers: [] } });
    removeModelProviderModelMock.mockReturnValue({ state: { providers: [] } });
    removeProviderCredentialMock.mockReturnValue({ providers: [] });
    cancelProviderOAuthLoginMock.mockReturnValue({ id: 'login-1', status: 'cancelled' });
    writeSavedDefaultCwdPreferenceMock.mockReturnValue({ cwd: '/next-repo' });
  });

  afterEach(() => {
    delete process.env.NEON_PILOT_KNOWLEDGE_ROOT;
    vi.useRealTimers();
    for (const files of allocatedFiles.splice(0)) {
      cleanupRouteFiles(files);
    }
  });

  function allocateFiles() {
    const files = createRouteFiles();
    allocatedFiles.push(files);
    return files;
  }

  it('reads and writes skill folder state with filesystem validation', () => {
    const { patchHandler, getHandler, materializeWebRuntimeConfig } = createDesktopHarness(allocateFiles());
    const validDir = mkdtempSync(join(tmpdir(), 'pa-skill-folders-'));
    const skillDirA = join(validDir, 'skills-a');
    const skillDirB = join(validDir, 'skills-b');
    const missingDir = join(validDir, 'missing');
    const invalidFile = join(validDir, 'not-a-dir.txt');
    mkdirSync(skillDirA, { recursive: true });
    mkdirSync(skillDirB, { recursive: true });
    writeFileSync(invalidFile, 'nope');

    machineConfig.skillDirs = [skillDirA];
    const readRes = createResponse();
    getHandler('/api/skill-folders')(createRequest(), readRes);
    expect(readRes.json).toHaveBeenCalledWith({
      configFile: '/config/config.json',
      skillDirs: [skillDirA],
    });

    const invalidRes = createResponse();
    patchHandler('/api/skill-folders')(createRequest({ body: { skillDirs: 'bad' } }), invalidRes);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(invalidRes.json).toHaveBeenCalledWith({ error: 'skillDirs must be an array of strings' });

    const missingRes = createResponse();
    patchHandler('/api/skill-folders')(createRequest({ body: { skillDirs: [missingDir] } }), missingRes);
    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(missingRes.json).toHaveBeenCalledWith({ error: `Directory does not exist: ${missingDir}` });

    const fileRes = createResponse();
    patchHandler('/api/skill-folders')(createRequest({ body: { skillDirs: [invalidFile] } }), fileRes);
    expect(fileRes.status).toHaveBeenCalledWith(400);
    expect(fileRes.json).toHaveBeenCalledWith({ error: `Not a directory: ${invalidFile}` });

    const saveRes = createResponse();
    patchHandler('/api/skill-folders')(createRequest({ body: { skillDirs: [skillDirA, skillDirB] } }), saveRes);
    expect(writeMachineSkillDirsMock).toHaveBeenCalledWith([skillDirA, skillDirB]);
    expect(materializeWebRuntimeConfig).toHaveBeenCalledWith('shared');
    expect(saveRes.json).toHaveBeenCalledWith({
      configFile: '/config/config.json',
      skillDirs: [skillDirA, skillDirB],
    });
  });

  it('reads and writes instruction file state with filesystem validation', () => {
    const { patchHandler, getHandler, materializeWebRuntimeConfig } = createDesktopHarness(allocateFiles());
    const validDir = mkdtempSync(join(tmpdir(), 'pa-instruction-files-'));
    const instructionA = join(validDir, 'AGENTS.md');
    const instructionB = join(validDir, 'custom.md');
    const missingFile = join(validDir, 'missing.md');
    writeFileSync(instructionA, '# Base\n');
    writeFileSync(instructionB, '# Custom\n');

    machineConfig.instructionFiles = [instructionA];
    const readRes = createResponse();
    getHandler('/api/instructions')(createRequest(), readRes);
    expect(readRes.json).toHaveBeenCalledWith({
      configFile: '/config/config.json',
      instructionFiles: [instructionA],
    });

    const invalidRes = createResponse();
    patchHandler('/api/instructions')(createRequest({ body: { instructionFiles: 'bad' } }), invalidRes);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(invalidRes.json).toHaveBeenCalledWith({ error: 'instructionFiles must be an array of strings' });

    const missingRes = createResponse();
    patchHandler('/api/instructions')(createRequest({ body: { instructionFiles: [missingFile] } }), missingRes);
    expect(missingRes.status).toHaveBeenCalledWith(400);
    expect(missingRes.json).toHaveBeenCalledWith({ error: `File does not exist: ${missingFile}` });

    const saveRes = createResponse();
    patchHandler('/api/instructions')(createRequest({ body: { instructionFiles: [instructionA, instructionB] } }), saveRes);
    expect(writeMachineInstructionFilesMock).toHaveBeenCalledWith([instructionA, instructionB]);
    expect(materializeWebRuntimeConfig).toHaveBeenCalledWith('shared');
    expect(saveRes.json).toHaveBeenCalledWith({
      configFile: '/config/config.json',
      instructionFiles: [instructionA, instructionB],
    });
  });

  it('reads and writes the system prompt template', () => {
    const { patchHandler, getHandler, materializeWebRuntimeConfig } = createDesktopHarness(allocateFiles());
    machineConfig.systemPromptTemplate = '# Existing\n';

    const readRes = createResponse();
    getHandler('/api/system-prompt-template')(createRequest(), readRes);
    expect(readRes.json).toHaveBeenCalledWith({
      configFile: '/config/config.json',
      template: '# Existing\n',
    });

    const invalidRes = createResponse();
    patchHandler('/api/system-prompt-template')(createRequest({ body: { template: 123 } }), invalidRes);
    expect(invalidRes.status).toHaveBeenCalledWith(400);
    expect(invalidRes.json).toHaveBeenCalledWith({ error: 'template must be a string' });

    const saveRes = createResponse();
    patchHandler('/api/system-prompt-template')(createRequest({ body: { template: '# Custom\n\n{{ knowledge_root }}\n' } }), saveRes);
    expect(writeMachineSystemPromptTemplateMock).toHaveBeenCalledWith('# Custom\n\n{{ knowledge_root }}\n');
    expect(materializeWebRuntimeConfig).toHaveBeenCalledWith('shared');
    expect(saveRes.json).toHaveBeenCalledWith({
      configFile: '/config/config.json',
      template: '# Custom\n\n{{ knowledge_root }}\n',
    });
  });
});
