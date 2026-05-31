interface HostCoreProcessExecInput {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
  maxBuffer?: number;
  env?: Record<string, string>;
}

interface HostCoreProcessExecResult {
  command: string;
  args: string[];
  cwd?: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  success: boolean;
  executionWrappers: Array<{ id: string; label?: string }>;
}

interface HostCoreSpawnResult {
  id: string;
  pid: number | null;
  usingPty: false;
  executionWrappers: Array<{ id: string; label?: string }>;
}

interface HostCoreProcessReadResult {
  id: string;
  stdout: string;
  stderr: string;
  exit?: { code: number | null; signal: string | null } | null;
}

function readHostCoreConfig(): { baseUrl: string; token: string } | null {
  const port = process.env.NEON_PILOT_TAURI_HOST_CORE_PORT?.trim();
  const token = process.env.NEON_PILOT_TAURI_HOST_CORE_TOKEN?.trim();
  if (!port || !token) return null;
  return { baseUrl: `http://127.0.0.1:${port}`, token };
}

export function isTauriHostCoreAvailable(): boolean {
  return readHostCoreConfig() !== null;
}

async function hostCoreRequest<T>(path: string, body: unknown = {}): Promise<T> {
  const config = readHostCoreConfig();
  if (!config) throw new Error('Tauri host-core RPC is unavailable.');
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const message =
      parsed && typeof parsed === 'object' && typeof (parsed as { error?: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return parsed as T;
}

export async function execTauriHostProcess(input: HostCoreProcessExecInput): Promise<HostCoreProcessExecResult> {
  const result = await hostCoreRequest<HostCoreProcessExecResult>('/process/exec', {
    command: input.command,
    args: input.args ?? [],
    cwd: input.cwd,
    timeoutMs: input.timeoutMs,
    maxBuffer: input.maxBuffer,
    env: input.env ?? {},
  });
  if (!result.success) {
    const error = new Error(result.stderr || `Command failed with exit code ${result.exitCode}.`);
    Object.assign(error, { stdout: result.stdout, stderr: result.stderr });
    throw error;
  }
  return result;
}

export async function spawnTauriHostProcess(input: {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}): Promise<HostCoreSpawnResult> {
  return hostCoreRequest<HostCoreSpawnResult>('/process/spawn', {
    command: input.command,
    args: input.args ?? [],
    cwd: input.cwd,
    env: input.env ?? {},
  });
}

export async function readTauriHostProcess(id: string): Promise<HostCoreProcessReadResult> {
  return hostCoreRequest<HostCoreProcessReadResult>('/process/read', { id });
}

export async function writeTauriHostProcess(id: string, data: string): Promise<void> {
  await hostCoreRequest('/process/write', { id, data });
}

export async function killTauriHostProcess(id: string): Promise<void> {
  await hostCoreRequest('/process/kill', { id });
}

export async function readTauriHostText(input: { root: string; path: string }): Promise<string> {
  return (await hostCoreRequest<{ text: string }>('/filesystem/read-text', input)).text;
}

export async function writeTauriHostText(input: { root: string; path: string; text: string }): Promise<unknown> {
  return hostCoreRequest('/filesystem/write-text', input);
}

export async function getTauriHostSecret(key: string): Promise<string | undefined> {
  return (await hostCoreRequest<{ value?: string | null }>('/secrets/get', { key })).value ?? undefined;
}

export async function setTauriHostSecret(key: string, value: string): Promise<unknown> {
  return hostCoreRequest('/secrets/set', { key, value });
}

export async function deleteTauriHostSecret(key: string): Promise<unknown> {
  return hostCoreRequest('/secrets/delete', { key });
}

export async function installTauriHostExtensionPackage(packageRoot: string): Promise<unknown> {
  return hostCoreRequest('/extensions/install', { packageRoot });
}

export async function importTauriHostExtensionBundle(zipPath: string): Promise<unknown> {
  return hostCoreRequest('/extensions/import-bundle', { zipPath });
}
