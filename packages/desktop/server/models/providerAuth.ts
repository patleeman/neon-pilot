import type { OAuthDeviceCodeInfo, OAuthPrompt, OAuthSelectPrompt } from '@earendil-works/pi-ai';
import { AuthStorage, type OAuthCredential } from '@earendil-works/pi-coding-agent';

import { deleteProviderApiKeySecret, resolveProviderApiKey, setProviderApiKeySecret } from '../secrets/secretStore.js';
import { createModelRegistryForAuthFile } from './modelRegistry.js';

export type ProviderAuthType = 'none' | 'api_key' | 'oauth' | 'environment';

export interface ProviderAuthSummary {
  id: string;
  modelCount: number;
  authType: ProviderAuthType;
  hasStoredCredential: boolean;
  apiKeySupported: boolean;
  oauthSupported: boolean;
  oauthProviderName: string;
  oauthUsesCallbackServer: boolean;
}

export interface ProviderAuthState {
  authFile: string;
  providers: ProviderAuthSummary[];
}

export type ProviderOAuthLoginStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface ProviderOAuthPromptState {
  message: string;
  placeholder: string;
  allowEmpty: boolean;
  manualCode: boolean;
}

export interface ProviderOAuthLoginState {
  id: string;
  provider: string;
  providerName: string;
  status: ProviderOAuthLoginStatus;
  authUrl: string;
  authInstructions: string;
  deviceCode: {
    userCode: string;
    verificationUri: string;
    expiresInSeconds?: number;
  } | null;
  prompt: ProviderOAuthPromptState | null;
  progress: string[];
  error: string;
  createdAt: string;
  updatedAt: string;
}

interface PendingOAuthInput {
  allowEmpty: boolean;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
}

interface ProviderOAuthLoginRun extends ProviderOAuthLoginState {
  abortController: AbortController;
  pendingInput: PendingOAuthInput | null;
}

const BUILT_IN_API_KEY_PROVIDERS: string[] = [
  'anthropic',
  'azure-openai-responses',
  'openai',
  'google',
  'mistral',
  'groq',
  'cerebras',
  'xai',
  'openrouter',
  'vercel-ai-gateway',
  'zai',
  'opencode',
  'opencode-go',
  'huggingface',
  'kimi-coding',
  'minimax',
  'minimax-cn',
  // Tool API providers (non-model)
  'exa',
];

const BUILT_IN_API_KEY_PROVIDER_SET = new Set<string>(BUILT_IN_API_KEY_PROVIDERS);
const NON_MODEL_SECRET_PROVIDERS = new Set(['telegram']);
const OAUTH_LOGIN_RETENTION_MS = 30 * 60_000;
const OAUTH_LOGIN_TIMEOUT_MS = 5 * 60_000;
const oauthLoginRuns = new Map<string, ProviderOAuthLoginRun>();
const oauthLoginListeners = new Map<string, Set<(state: ProviderOAuthLoginState) => void>>();
const oauthLoginGlobalListeners = new Set<(state: ProviderOAuthLoginState) => void>();

function nowIso(): string {
  return new Date().toISOString();
}

function notifyOAuthLoginListeners(run: ProviderOAuthLoginRun): void {
  const state = toPublicLoginState(run);
  const listeners = oauthLoginListeners.get(run.id);

  if (listeners) {
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  for (const listener of [...oauthLoginGlobalListeners]) {
    listener(state);
  }
}

export function subscribeProviderOAuthLogin(loginId: string, listener: (state: ProviderOAuthLoginState) => void): () => void {
  const normalizedLoginId = loginId.trim();
  if (!normalizedLoginId) {
    return () => {};
  }

  const listeners = oauthLoginListeners.get(normalizedLoginId) ?? new Set<(state: ProviderOAuthLoginState) => void>();
  listeners.add(listener);
  oauthLoginListeners.set(normalizedLoginId, listeners);

  return () => {
    const currentListeners = oauthLoginListeners.get(normalizedLoginId);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      oauthLoginListeners.delete(normalizedLoginId);
    }
  };
}

export function subscribeProviderOAuthLogins(listener: (state: ProviderOAuthLoginState) => void): () => void {
  oauthLoginGlobalListeners.add(listener);
  return () => {
    oauthLoginGlobalListeners.delete(listener);
  };
}

function createLoginId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeProvider(provider: string): string {
  return provider.trim();
}

function readModelCounts(authFile: string): Map<string, number> {
  const registry = createModelRegistryForAuthFile(authFile);
  const counts = new Map<string, number>();

  for (const model of registry.getAvailable()) {
    const provider = typeof model.provider === 'string' ? model.provider.trim() : '';
    if (!provider) {
      continue;
    }

    counts.set(provider, (counts.get(provider) ?? 0) + 1);
  }

  return counts;
}

function deriveAuthType(
  authStorage: AuthStorage,
  provider: string,
  stateRoot?: string,
): {
  authType: ProviderAuthType;
  hasStoredCredential: boolean;
} {
  if (stateRoot && resolveProviderApiKey(provider, stateRoot)) {
    return { authType: 'api_key', hasStoredCredential: true };
  }

  const credential = authStorage.get(provider);
  const hasStoredCredential = credential !== undefined;

  if (credential?.type === 'oauth') {
    return { authType: 'oauth', hasStoredCredential };
  }

  if (credential?.type === 'api_key') {
    return { authType: 'api_key', hasStoredCredential };
  }

  if (authStorage.hasAuth(provider)) {
    return { authType: 'environment', hasStoredCredential };
  }

  return { authType: 'none', hasStoredCredential };
}

function hasUsableStoredCredential(authStorage: AuthStorage, provider: string): boolean {
  const credential = authStorage.get(provider);
  if (credential !== undefined) {
    return credential.type === 'oauth' || credential.type === 'api_key';
  }
  return authStorage.hasAuth(provider);
}

function makeAuthStorage(authFile: string): AuthStorage {
  return AuthStorage.create(authFile);
}

export function readProviderAuthState(authFile: string, stateRoot?: string): ProviderAuthState {
  const authStorage = makeAuthStorage(authFile);
  const modelCounts = readModelCounts(authFile);
  const oauthProvidersById = new Map(authStorage.getOAuthProviders().map((provider) => [provider.id, provider]));

  const providers = new Set<string>([
    ...BUILT_IN_API_KEY_PROVIDER_SET,
    ...modelCounts.keys(),
    ...authStorage.list().filter((provider) => hasUsableStoredCredential(authStorage, provider)),
    ...oauthProvidersById.keys(),
  ]);

  const summaries = [...providers]
    .filter((provider) => !NON_MODEL_SECRET_PROVIDERS.has(provider))
    .sort((left, right) => left.localeCompare(right))
    .map((provider) => {
      const oauthProvider = oauthProvidersById.get(provider);
      const { authType, hasStoredCredential } = deriveAuthType(authStorage, provider, stateRoot);

      return {
        id: provider,
        modelCount: modelCounts.get(provider) ?? 0,
        authType,
        hasStoredCredential,
        apiKeySupported: BUILT_IN_API_KEY_PROVIDER_SET.has(provider),
        oauthSupported: oauthProvider !== undefined,
        oauthProviderName: oauthProvider?.name ?? '',
        oauthUsesCallbackServer: Boolean(oauthProvider?.usesCallbackServer),
      } satisfies ProviderAuthSummary;
    });

  return {
    authFile,
    providers: summaries,
  };
}

export function setProviderApiKey(authFile: string, providerInput: string, apiKeyInput: string, stateRoot?: string): ProviderAuthState {
  const provider = normalizeProvider(providerInput);
  if (!provider) {
    throw new Error('provider is required');
  }

  const apiKey = apiKeyInput.trim();
  if (!apiKey) {
    throw new Error('apiKey is required');
  }

  if (stateRoot) {
    setProviderApiKeySecret(provider, apiKey, stateRoot);
    makeAuthStorage(authFile).remove(provider);
    return readProviderAuthState(authFile, stateRoot);
  }

  const authStorage = makeAuthStorage(authFile);
  authStorage.set(provider, { type: 'api_key', key: apiKey });
  return readProviderAuthState(authFile);
}

export function removeProviderCredential(authFile: string, providerInput: string, stateRoot?: string): ProviderAuthState {
  const provider = normalizeProvider(providerInput);
  if (!provider) {
    throw new Error('provider is required');
  }

  if (stateRoot) {
    deleteProviderApiKeySecret(provider, stateRoot);
  }
  const authStorage = makeAuthStorage(authFile);
  authStorage.remove(provider);
  return readProviderAuthState(authFile, stateRoot);
}

function toPromptState(prompt: OAuthPrompt, manualCode: boolean): ProviderOAuthPromptState {
  return {
    message: prompt.message,
    placeholder: typeof prompt.placeholder === 'string' ? prompt.placeholder : '',
    allowEmpty: prompt.allowEmpty === true,
    manualCode,
  };
}

function formatDeviceCodeInstructions(info: OAuthDeviceCodeInfo): string {
  const codeLine = info.userCode ? `Enter code: ${info.userCode}` : '';
  const expiryLine = typeof info.expiresInSeconds === 'number' ? `Code expires in ${info.expiresInSeconds} seconds.` : '';
  return ['Open the verification URL in your browser to continue OAuth login.', codeLine, expiryLine].filter(Boolean).join('\n');
}

function toSelectPromptState(prompt: OAuthSelectPrompt): ProviderOAuthPromptState {
  const optionLines = prompt.options.map((option, index) => `${index + 1}. ${option.label} (${option.id})`);
  return {
    message: [prompt.message, ...optionLines].join('\n'),
    placeholder: 'Enter an option number or id',
    allowEmpty: true,
    manualCode: false,
  };
}

function normalizeSelectInput(prompt: OAuthSelectPrompt, input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  const numericIndex = Number(trimmed);
  if (Number.isInteger(numericIndex) && numericIndex >= 1 && numericIndex <= prompt.options.length) {
    return prompt.options[numericIndex - 1]?.id;
  }

  const normalized = trimmed.toLowerCase();
  const match = prompt.options.find((option) => option.id.toLowerCase() === normalized || option.label.toLowerCase() === normalized);
  return match?.id ?? trimmed;
}

function rejectPendingInput(run: ProviderOAuthLoginRun, reason: string): void {
  const pendingInput = run.pendingInput;
  run.pendingInput = null;
  if (!pendingInput) {
    return;
  }

  pendingInput.reject(new Error(reason));
}

function createPromptAwaiter(run: ProviderOAuthLoginRun, prompt: ProviderOAuthPromptState): Promise<string> {
  rejectPendingInput(run, 'Login prompt superseded.');
  run.prompt = prompt;
  run.updatedAt = nowIso();
  notifyOAuthLoginListeners(run);

  return new Promise<string>((resolve, reject) => {
    if (run.abortController.signal.aborted) {
      reject(new Error('Login cancelled'));
      return;
    }

    run.pendingInput = {
      allowEmpty: prompt.allowEmpty,
      resolve,
      reject,
    };
  });
}

function toPublicLoginState(run: ProviderOAuthLoginRun): ProviderOAuthLoginState {
  return {
    id: run.id,
    provider: run.provider,
    providerName: run.providerName,
    status: run.status,
    authUrl: run.authUrl,
    authInstructions: run.authInstructions,
    deviceCode: run.deviceCode ? { ...run.deviceCode } : null,
    prompt: run.prompt ? { ...run.prompt } : null,
    progress: [...run.progress],
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

function pruneOAuthLoginRuns(): void {
  const now = Date.now();

  for (const [id, run] of oauthLoginRuns) {
    if (run.status === 'running') {
      continue;
    }

    const updatedAtMs = Date.parse(run.updatedAt);
    if (Number.isNaN(updatedAtMs)) {
      continue;
    }

    if (now - updatedAtMs > OAUTH_LOGIN_RETENTION_MS) {
      oauthLoginRuns.delete(id);
      oauthLoginListeners.delete(id);
    }
  }
}

function finalizeOAuthLogin(run: ProviderOAuthLoginRun, status: ProviderOAuthLoginStatus, error: string): void {
  rejectPendingInput(run, status === 'completed' ? 'Login completed' : 'Login cancelled');
  run.prompt = null;
  run.status = status;
  run.error = error;
  run.updatedAt = nowIso();
  notifyOAuthLoginListeners(run);
}

function appendProgress(run: ProviderOAuthLoginRun, message: string): void {
  const normalized = message.trim();
  if (!normalized) {
    return;
  }

  run.progress = [...run.progress, normalized].slice(-12);
  run.updatedAt = nowIso();
  notifyOAuthLoginListeners(run);
}

function isOAuthCredential(credential: ReturnType<AuthStorage['get']>): credential is OAuthCredential {
  return credential?.type === 'oauth';
}

export function startProviderOAuthLogin(authFile: string, providerInput: string): ProviderOAuthLoginState {
  pruneOAuthLoginRuns();

  const provider = normalizeProvider(providerInput);
  if (!provider) {
    throw new Error('provider is required');
  }

  const authStorage = makeAuthStorage(authFile);
  const oauthProvider = authStorage.getOAuthProviders().find((candidate) => candidate.id === provider);
  if (!oauthProvider) {
    throw new Error(`Provider does not support OAuth login: ${provider}`);
  }

  for (const run of oauthLoginRuns.values()) {
    if (run.provider === provider && run.status === 'running') {
      return toPublicLoginState(run);
    }
  }

  const timestamp = nowIso();
  const run: ProviderOAuthLoginRun = {
    id: createLoginId(),
    provider,
    providerName: oauthProvider.name,
    status: 'running',
    authUrl: '',
    authInstructions: '',
    deviceCode: null,
    prompt: null,
    progress: [],
    error: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    abortController: new AbortController(),
    pendingInput: null,
  };

  oauthLoginRuns.set(run.id, run);

  const loginTimeout = setTimeout(() => {
    if (run.status === 'running') {
      run.abortController.abort();
      finalizeOAuthLogin(
        run,
        'failed',
        'Login timed out — the browser callback was not received. If you completed login in the browser, try removing the provider and re-adding it.',
      );
    }
  }, OAUTH_LOGIN_TIMEOUT_MS);

  void authStorage
    .login(provider, {
      onAuth: (info) => {
        run.authUrl = info.url;
        run.authInstructions = typeof info.instructions === 'string' ? info.instructions : '';
        run.deviceCode = null;
        run.updatedAt = nowIso();
        notifyOAuthLoginListeners(run);
      },
      onDeviceCode: (info) => {
        run.authUrl = info.verificationUri;
        run.authInstructions = formatDeviceCodeInstructions(info);
        run.deviceCode = {
          userCode: info.userCode,
          verificationUri: info.verificationUri,
          ...(typeof info.expiresInSeconds === 'number' ? { expiresInSeconds: info.expiresInSeconds } : {}),
        };
        run.updatedAt = nowIso();
        notifyOAuthLoginListeners(run);
      },
      onPrompt: async (prompt) => {
        const state = toPromptState(prompt, false);
        return createPromptAwaiter(run, state);
      },
      onProgress: (message) => {
        appendProgress(run, message);
      },
      onSelect: async (prompt) => normalizeSelectInput(prompt, await createPromptAwaiter(run, toSelectPromptState(prompt))),
      onManualCodeInput: async () =>
        createPromptAwaiter(run, {
          message: 'Paste the full redirect URL from the browser address bar. If the browser shows State mismatch, paste that URL here.',
          placeholder: 'http://localhost:1455/auth/callback?code=...',
          allowEmpty: false,
          manualCode: true,
        }),
      signal: run.abortController.signal,
    })
    .then(() => {
      const credential = authStorage.get(provider);
      if (!isOAuthCredential(credential)) {
        finalizeOAuthLogin(run, 'failed', `OAuth login for ${provider} did not persist credentials.`);
        return;
      }

      finalizeOAuthLogin(run, 'completed', '');
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (run.abortController.signal.aborted || message === 'Login cancelled') {
        finalizeOAuthLogin(run, 'cancelled', '');
        return;
      }

      finalizeOAuthLogin(run, 'failed', message);
    })
    .finally(() => {
      clearTimeout(loginTimeout);
    });

  return toPublicLoginState(run);
}

export function getProviderOAuthLoginState(loginId: string): ProviderOAuthLoginState | null {
  pruneOAuthLoginRuns();

  const run = oauthLoginRuns.get(loginId);
  if (!run) {
    return null;
  }

  return toPublicLoginState(run);
}

export function submitProviderOAuthLoginInput(loginId: string, valueInput: string): ProviderOAuthLoginState {
  pruneOAuthLoginRuns();

  const run = oauthLoginRuns.get(loginId);
  if (!run) {
    throw new Error(`OAuth login not found: ${loginId}`);
  }

  if (run.status !== 'running') {
    throw new Error(`OAuth login is not running: ${loginId}`);
  }

  const pendingInput = run.pendingInput;
  if (!pendingInput) {
    throw new Error('OAuth login is not waiting for input');
  }

  const value = valueInput;
  if (!pendingInput.allowEmpty && value.trim().length === 0) {
    throw new Error('Input is required');
  }

  run.pendingInput = null;
  run.prompt = null;
  run.updatedAt = nowIso();
  notifyOAuthLoginListeners(run);
  pendingInput.resolve(value);

  return toPublicLoginState(run);
}

export function cancelProviderOAuthLogin(loginId: string): ProviderOAuthLoginState {
  pruneOAuthLoginRuns();

  const run = oauthLoginRuns.get(loginId);
  if (!run) {
    throw new Error(`OAuth login not found: ${loginId}`);
  }

  if (run.status === 'running') {
    run.abortController.abort();
    finalizeOAuthLogin(run, 'cancelled', '');
  }

  return toPublicLoginState(run);
}
