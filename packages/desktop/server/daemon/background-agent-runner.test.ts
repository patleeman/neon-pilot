import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

const extensionHostClient = vi.hoisted(() => ({
  setExtensionHostClient: vi.fn(),
  createExtensionHostRpcClient: vi.fn((input: unknown) => ({ kind: 'rpc-client', input })),
}));
const cliControlPlane = vi.hoisted(() => ({
  readNeonPilotCliControlPlaneRecord: vi.fn(),
}));

vi.mock('../cliControlPlane.js', () => cliControlPlane);

vi.mock('../extensions/extensionHostClient.js', () => ({
  setExtensionHostClient: extensionHostClient.setExtensionHostClient,
}));

vi.mock('../extensions/extensionHostRpcClient.js', () => ({
  createExtensionHostRpcClient: extensionHostClient.createExtensionHostRpcClient,
}));

import {
  collectAssistantErrorMessages,
  collectAssistantTexts,
  configureExtensionHostClientForBackgroundAgent,
  configureExtensionHostClientFromEnv,
  extractTextContent,
  shouldRunBackgroundAgentMain,
} from './background-agent-runner.js';

describe('background agent runner output capture', () => {
  it('extracts final assistant text from session messages when no stream deltas were captured', () => {
    expect(
      collectAssistantTexts({
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'hello' }] },
          { role: 'assistant', content: [{ type: 'text', text: 'subagent works' }] },
        ],
      }),
    ).toEqual(['subagent works']);
  });

  it('extracts string and multipart text content', () => {
    expect(extractTextContent('plain text')).toBe('plain text');
    expect(extractTextContent([{ type: 'text', text: 'first' }, { type: 'image', data: 'ignored' }, 'second'])).toBe('first\nsecond');
  });

  it('captures assistant error messages for failed subagent logs and result summaries', () => {
    expect(
      collectAssistantErrorMessages({
        messages: [
          { role: 'assistant', content: [], errorMessage: '  model exploded  ' },
          { role: 'assistant', content: [{ type: 'text', text: 'ignored' }] },
        ],
      }),
    ).toEqual(['model exploded']);
  });

  it('runs from daemon-spawned Electron Node children even when argv path differs', () => {
    const moduleUrl = pathToFileURL(
      '/Applications/Neon Pilot RC.app/Contents/Resources/app.asar/server/dist/background-agent-runner.js',
    ).href;

    expect(shouldRunBackgroundAgentMain(moduleUrl, '/private/var/folders/runner.js', { NEON_PILOT_RUN_ID: 'run-123' })).toBe(true);
    expect(shouldRunBackgroundAgentMain(moduleUrl, fileURLToPath(moduleUrl), {})).toBe(true);
    expect(shouldRunBackgroundAgentMain(moduleUrl, '/private/var/folders/runner.js', {})).toBe(false);
  });

  it('configures extension-host RPC for daemon-spawned background agents', () => {
    extensionHostClient.setExtensionHostClient.mockClear();
    extensionHostClient.createExtensionHostRpcClient.mockClear();
    cliControlPlane.readNeonPilotCliControlPlaneRecord.mockReset();

    expect(
      configureExtensionHostClientFromEnv({
        NEON_PILOT_EXTENSION_HOST_BASE_URL: ' http://127.0.0.1:1234 ',
        NEON_PILOT_EXTENSION_HOST_TOKEN: ' secret ',
      }),
    ).toBe(true);

    expect(extensionHostClient.createExtensionHostRpcClient).toHaveBeenCalledWith({ baseUrl: 'http://127.0.0.1:1234', token: 'secret' });
    expect(extensionHostClient.setExtensionHostClient).toHaveBeenCalledWith({
      kind: 'rpc-client',
      input: { baseUrl: 'http://127.0.0.1:1234', token: 'secret' },
    });
  });

  it('leaves the extension-host client unset when RPC env is missing', () => {
    extensionHostClient.setExtensionHostClient.mockClear();
    extensionHostClient.createExtensionHostRpcClient.mockClear();
    cliControlPlane.readNeonPilotCliControlPlaneRecord.mockReset();

    expect(configureExtensionHostClientFromEnv({})).toBe(false);

    expect(extensionHostClient.createExtensionHostRpcClient).not.toHaveBeenCalled();
    expect(extensionHostClient.setExtensionHostClient).not.toHaveBeenCalled();
  });

  it('discovers extension-host RPC from the app control-plane file when env is missing', () => {
    extensionHostClient.setExtensionHostClient.mockClear();
    extensionHostClient.createExtensionHostRpcClient.mockClear();
    cliControlPlane.readNeonPilotCliControlPlaneRecord.mockReset();
    cliControlPlane.readNeonPilotCliControlPlaneRecord.mockReturnValueOnce({
      version: 1,
      pid: 123,
      updatedAt: '2026-06-06T00:00:00.000Z',
      extensionHost: { baseUrl: 'http://127.0.0.1:9876', token: 'control-token' },
    });

    expect(configureExtensionHostClientForBackgroundAgent({})).toBe(true);

    expect(extensionHostClient.createExtensionHostRpcClient).toHaveBeenCalledWith({
      baseUrl: 'http://127.0.0.1:9876',
      token: 'control-token',
    });
    expect(extensionHostClient.setExtensionHostClient).toHaveBeenCalledWith({
      kind: 'rpc-client',
      input: { baseUrl: 'http://127.0.0.1:9876', token: 'control-token' },
    });
  });
});
