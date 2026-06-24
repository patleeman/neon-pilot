import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https';
import { homedir } from 'node:os';
import { join } from 'node:path';

type DispatchLocalRequest = (input: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}) => Promise<{ statusCode: number; headers: Record<string, string>; body: Uint8Array }>;

type Logger = {
  info?: (message: string, fields?: Record<string, unknown>) => void;
  warn?: (message: string, fields?: Record<string, unknown>) => void;
};

type ListenerState = { enabled: true; port: number } | { enabled: false; port: number; error: string };

export interface LocalhostWebappProxyStatus {
  running: boolean;
  https: ListenerState;
  http: ListenerState;
  certificate: {
    available: boolean;
    trusted: boolean;
    certPath: string;
    keyPath: string;
  };
  urls: {
    scheme: 'https' | 'http';
    defaultPort: boolean;
  };
}

export interface LocalhostWebappProxy {
  status(): LocalhostWebappProxyStatus;
  trustCertificate(): LocalhostWebappProxyStatus & { ok: boolean; error?: string };
  close(): Promise<void>;
}

const DEFAULT_HTTPS_PORT = 443;
const DEFAULT_HTTP_PORT = 80;
const LOCALHOST_SUFFIX = '.localhost';
const PROXY_HEADER = 'X-Neon-Pilot-Localhost-Proxy';

let activeProxy: LocalhostWebappProxy | null = null;

function normalizeHostHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const host = (raw ?? '').trim().toLowerCase();
  if (!host) return '';
  if (host.startsWith('[')) {
    const closing = host.indexOf(']');
    return closing >= 0 ? host.slice(1, closing) : host;
  }
  return host.split(':')[0] ?? '';
}

function isWebappLocalhost(host: string): boolean {
  return host.endsWith(LOCALHOST_SUFFIX) && host.length > LOCALHOST_SUFFIX.length;
}

function readRequestBody(request: IncomingMessage): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => {
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined);
    });
  });
}

function normalizeRequestHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return normalized;
}

function requestProtocol(request: IncomingMessage): 'http' | 'https' {
  return (request.socket as { encrypted?: boolean }).encrypted ? 'https' : 'http';
}

function buildDispatchHeadersForWebappRequest(request: IncomingMessage, hostname: string): Record<string, string> {
  const headers = normalizeRequestHeaders(request.headers);
  const proto = requestProtocol(request);
  const host = headers.host || hostname;
  headers['x-forwarded-host'] = host;
  headers['x-forwarded-proto'] = proto;
  if (!headers.origin) {
    headers.origin = `${proto}://${host}`;
  }
  return headers;
}

function writeDispatchResponse(response: ServerResponse, result: Awaited<ReturnType<DispatchLocalRequest>>): void {
  const headers: Record<string, string> = { ...result.headers, [PROXY_HEADER]: '1' };
  delete headers['connection'];
  delete headers['content-length'];
  delete headers['transfer-encoding'];
  response.writeHead(result.statusCode, headers);
  response.end(Buffer.from(result.body));
}

function writeError(response: ServerResponse, statusCode: number, message: string): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    [PROXY_HEADER]: '1',
  });
  response.end(JSON.stringify({ error: message }));
}

function certificateDir(stateRoot: string): string {
  return join(stateRoot, 'desktop', 'localhost-webapp-proxy');
}

function certificatePaths(stateRoot: string): { dir: string; certPath: string; keyPath: string; configPath: string } {
  const dir = certificateDir(stateRoot);
  return {
    dir,
    certPath: join(dir, 'localhost-webapp.crt'),
    keyPath: join(dir, 'localhost-webapp.key'),
    configPath: join(dir, 'openssl.cnf'),
  };
}

function buildCertificateConfig(hostnames: string[]): string {
  const names = Array.from(new Set(['localhost', ...hostnames.map((hostname) => hostname.trim().toLowerCase()).filter(Boolean)])).sort();
  return [
    '[req]',
    'distinguished_name=req_distinguished_name',
    'x509_extensions=v3_req',
    'prompt=no',
    '[req_distinguished_name]',
    `CN=${names[0] ?? 'localhost'}`,
    '[v3_req]',
    'subjectAltName=@alt_names',
    '[alt_names]',
    ...names.map((name, index) => `DNS.${index + 1}=${name}`),
    '',
  ].join('\n');
}

export function buildOpenSslSpawnEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  if (baseEnv.PATH) env.PATH = baseEnv.PATH;
  if (process.platform === 'win32' && baseEnv.SystemRoot) env.SystemRoot = baseEnv.SystemRoot;
  return env;
}

function ensureCertificate(
  stateRoot: string,
  hostnames: string[] = [],
): { certPath: string; keyPath: string; generated: boolean; error?: string } {
  const paths = certificatePaths(stateRoot);
  mkdirSync(paths.dir, { recursive: true, mode: 0o700 });
  chmodSync(paths.dir, 0o700);
  const config = buildCertificateConfig(hostnames);
  if (
    existsSync(paths.certPath) &&
    existsSync(paths.keyPath) &&
    existsSync(paths.configPath) &&
    readFileSync(paths.configPath, 'utf-8') === config
  ) {
    chmodSync(paths.keyPath, 0o600);
    return { certPath: paths.certPath, keyPath: paths.keyPath, generated: false };
  }

  writeFileSync(paths.configPath, config, { mode: 0o600 });
  chmodSync(paths.configPath, 0o600);

  const result = spawnSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '825',
      '-keyout',
      paths.keyPath,
      '-out',
      paths.certPath,
      '-config',
      paths.configPath,
      '-extensions',
      'v3_req',
    ],
    { encoding: 'utf-8', env: buildOpenSslSpawnEnv() },
  );

  if (result.error || result.status !== 0) {
    return {
      certPath: paths.certPath,
      keyPath: paths.keyPath,
      generated: false,
      error: result.error?.message || result.stderr.trim() || result.stdout.trim() || 'OpenSSL failed to generate a localhost certificate.',
    };
  }

  chmodSync(paths.keyPath, 0o600);
  return { certPath: paths.certPath, keyPath: paths.keyPath, generated: true };
}

function readCertificate(
  stateRoot: string,
  hostnames: string[] = [],
):
  | { cert: Buffer; key: Buffer; certPath: string; keyPath: string; error?: undefined }
  | { certPath: string; keyPath: string; error: string } {
  const cert = ensureCertificate(stateRoot, hostnames);
  if (cert.error) return { certPath: cert.certPath, keyPath: cert.keyPath, error: cert.error };
  try {
    return {
      cert: readFileSync(cert.certPath),
      key: readFileSync(cert.keyPath),
      certPath: cert.certPath,
      keyPath: cert.keyPath,
    };
  } catch (error) {
    return {
      certPath: cert.certPath,
      keyPath: cert.keyPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isCertificateTrusted(certPath: string): boolean {
  if (process.platform !== 'darwin') return false;
  const result = spawnSync('security', ['verify-cert', '-c', certPath], { encoding: 'utf-8' });
  return result.status === 0;
}

function trustCertificate(certPath: string): { ok: true } | { ok: false; error: string } {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'Automatic localhost certificate trust is currently implemented for macOS only.' };
  }
  const result = spawnSync(
    'security',
    ['add-trusted-cert', '-d', '-r', 'trustRoot', '-k', join(homedir(), 'Library', 'Keychains', 'login.keychain-db'), certPath],
    { encoding: 'utf-8' },
  );
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      error:
        result.error?.message ||
        result.stderr.trim() ||
        result.stdout.trim() ||
        'Could not add localhost certificate to the login keychain.',
    };
  }
  return { ok: true };
}

function listen(server: HttpServer | HttpsServer, port: number, host: string): Promise<ListenerState> {
  return new Promise((resolve) => {
    const onError = (error: NodeJS.ErrnoException) => {
      server.off('listening', onListening);
      resolve({ enabled: false, port, error: error.message });
    };
    const onListening = () => {
      server.off('error', onError);
      const address = server.address();
      const boundPort = address && typeof address === 'object' ? address.port : port;
      resolve({ enabled: true, port: boundPort });
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function listenWithFallback(input: {
  create: () => HttpServer | HttpsServer;
  port: number;
  host: string;
}): Promise<{ server: HttpServer | HttpsServer | null; state: ListenerState }> {
  const firstServer = input.create();
  const firstState = await listen(firstServer, input.port, input.host);
  if (firstState.enabled || input.port === 0) {
    return { server: firstState.enabled ? firstServer : null, state: firstState };
  }
  firstServer.close();
  const fallbackServer = input.create();
  const fallbackState = await listen(fallbackServer, 0, input.host);
  return { server: fallbackState.enabled ? fallbackServer : null, state: fallbackState.enabled ? fallbackState : firstState };
}

export async function startLocalhostWebappProxy(options: {
  stateRoot: string;
  dispatch: DispatchLocalRequest;
  logger?: Logger;
  httpPort?: number;
  httpsPort?: number | null;
  host?: string;
  certificateHostnames?: string[];
}): Promise<LocalhostWebappProxy> {
  if (activeProxy) return activeProxy;
  const host = options.host ?? '127.0.0.1';
  const httpPort = options.httpPort ?? DEFAULT_HTTP_PORT;
  const desiredHttpsPort = options.httpsPort === undefined ? DEFAULT_HTTPS_PORT : options.httpsPort;
  const certificate =
    desiredHttpsPort === null
      ? {
          certPath: certificatePaths(options.stateRoot).certPath,
          keyPath: certificatePaths(options.stateRoot).keyPath,
          error: 'HTTPS listener disabled.',
        }
      : readCertificate(options.stateRoot, options.certificateHostnames);
  let httpsState: ListenerState = {
    enabled: false,
    port: desiredHttpsPort ?? DEFAULT_HTTPS_PORT,
    error: certificate.error ?? 'HTTPS listener disabled.',
  };
  const dispatchRequest = async (request: IncomingMessage, response: ServerResponse) => {
    const hostname = normalizeHostHeader(request.headers.host);
    if (!isWebappLocalhost(hostname)) {
      writeError(response, 404, 'No Neon Pilot webapp is registered for this host.');
      return;
    }
    const method = (request.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      writeError(response, 405, `Unsupported method: ${method}`);
      return;
    }
    const abort = new AbortController();
    request.on('aborted', () => abort.abort());
    response.on('close', () => abort.abort());
    const body = await readRequestBody(request);
    const result = await options.dispatch({
      method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      path: request.url ?? '/',
      body,
      headers: buildDispatchHeadersForWebappRequest(request, hostname),
      signal: abort.signal,
    });
    writeDispatchResponse(response, result);
  };

  const createHttpsListener = () =>
    createHttpsServer(
      { cert: 'cert' in certificate ? certificate.cert : Buffer.alloc(0), key: 'key' in certificate ? certificate.key : Buffer.alloc(0) },
      (request, response) => {
        void dispatchRequest(request, response).catch((error) => {
          writeError(response, 500, error instanceof Error ? error.message : String(error));
        });
      },
    );

  let httpsServer: HttpsServer | null = null;
  if (desiredHttpsPort !== null && !certificate.error) {
    const listener = await listenWithFallback({ create: createHttpsListener, port: desiredHttpsPort, host });
    httpsState = listener.state;
    httpsServer = listener.server as HttpsServer | null;
  }

  const createHttpListener = () =>
    createServer((request, response) => {
      const hostname = normalizeHostHeader(request.headers.host);
      if (httpsState.enabled && isWebappLocalhost(hostname)) {
        const portSuffix = httpsState.port === DEFAULT_HTTPS_PORT ? '' : `:${String(httpsState.port)}`;
        response.writeHead(302, {
          Location: `https://${hostname}${portSuffix}${request.url || '/'}`,
          [PROXY_HEADER]: '1',
        });
        response.end();
        return;
      }
      void dispatchRequest(request, response).catch((error) => {
        writeError(response, 500, error instanceof Error ? error.message : String(error));
      });
    });
  const httpListener = await listenWithFallback({ create: createHttpListener, port: httpPort, host });
  const httpServer = httpListener.server as HttpServer | null;
  const httpState = httpListener.state;

  const status = (): LocalhostWebappProxyStatus => {
    const scheme = httpsState.enabled ? 'https' : 'http';
    return {
      running: httpsState.enabled || httpState.enabled,
      https: httpsState,
      http: httpState,
      certificate: {
        available: !certificate.error,
        trusted: !certificate.error && isCertificateTrusted(certificate.certPath),
        certPath: certificate.certPath,
        keyPath: certificate.keyPath,
      },
      urls: {
        scheme,
        defaultPort:
          scheme === 'https'
            ? httpsState.enabled && httpsState.port === DEFAULT_HTTPS_PORT
            : httpState.enabled && httpState.port === DEFAULT_HTTP_PORT,
      },
    };
  };

  activeProxy = {
    status,
    trustCertificate() {
      const result = trustCertificate(certificate.certPath);
      return { ...status(), ...result };
    },
    async close() {
      await Promise.all([
        new Promise<void>((resolve) => {
          if (!httpsServer) {
            resolve();
            return;
          }
          httpsServer.close(() => resolve());
        }),
        new Promise<void>((resolve) => {
          if (!httpServer) {
            resolve();
            return;
          }
          httpServer.close(() => resolve());
        }),
      ]);
      if (activeProxy === this) activeProxy = null;
    },
  };

  const currentStatus = activeProxy.status();
  options.logger?.info?.('localhost webapp proxy started', currentStatus as unknown as Record<string, unknown>);
  if (!currentStatus.https.enabled || !currentStatus.http.enabled) {
    options.logger?.warn?.('localhost webapp proxy started with degraded listeners', currentStatus as unknown as Record<string, unknown>);
  }
  return activeProxy;
}

export function getLocalhostWebappProxyStatus(): LocalhostWebappProxyStatus | null {
  return activeProxy?.status() ?? null;
}

export function trustLocalhostWebappProxyCertificate(): (LocalhostWebappProxyStatus & { ok: boolean; error?: string }) | null {
  return activeProxy?.trustCertificate() ?? null;
}
