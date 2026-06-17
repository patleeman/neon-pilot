import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { dirname, join, resolve } from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const backendChildPath = join(repoRoot, 'packages/desktop/dist/backend/local-backend-child.js');
const extensionHostChildPath = join(repoRoot, 'packages/desktop/dist/backend/extension-host-child.js');
const holdMsArg = process.argv.find((arg) => arg.startsWith('--hold-ms='));
const holdMs = holdMsArg ? Number(holdMsArg.slice('--hold-ms='.length)) : 0;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function writeFile(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function listen(server, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Server did not bind a TCP port.'));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function readIncomingBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function createProxyTargetServer() {
  const server = http.createServer((request, response) => {
    void (async () => {
      if (request.url?.startsWith('/live')) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(`<main data-target="loopback"><h1>Loopback Sidecar</h1><p>${request.headers.host ?? ''}</p></main>`);
        return;
      }

      if (request.url?.startsWith('/echo')) {
        const body = await readIncomingBody(request);
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(
          JSON.stringify({
            method: request.method,
            url: request.url,
            body,
            contentType: request.headers['content-type'] ?? null,
          }),
        );
        return;
      }

      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('missing target route');
    })().catch((error) => {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error instanceof Error ? error.message : String(error));
    });
  });
  const port = await listen(server);
  return { server, port };
}

function createQaExtension(stateRoot, targetPort) {
  const extensionRoot = join(stateRoot, 'extensions', 'qa-webapp-sidecar');
  writeFile(
    join(extensionRoot, 'extension.json'),
    JSON.stringify(
      {
        schemaVersion: 2,
        id: 'qa-webapp-sidecar',
        name: 'QA Webapp Sidecar',
        version: '0.0.0-smoke',
        contributes: {
          webapps: [
            {
              id: 'static',
              title: 'Static QA Sidecar',
              entry: 'dist/static/index.html',
            },
            {
              id: 'proxy',
              title: 'Proxy QA Sidecar',
              target: `http://127.0.0.1:${targetPort}`,
            },
          ],
        },
      },
      null,
      2,
    ),
  );
  writeFile(
    join(extensionRoot, 'dist/static/index.html'),
    [
      '<!doctype html>',
      '<html>',
      '<head>',
      '  <meta charset="utf-8" />',
      '  <title>Static QA Sidecar</title>',
      '  <link rel="stylesheet" href="./style.css" />',
      '</head>',
      '<body>',
      '  <main data-webapp="static">',
      '    <h1>Static QA Sidecar</h1>',
      '    <p id="route-marker">extension webapp static route loaded</p>',
      '    <script src="./app.js"></script>',
      '  </main>',
      '</body>',
      '</html>',
      '',
    ].join('\n'),
  );
  writeFile(join(extensionRoot, 'dist/static/app.js'), "document.body.dataset.sidecarReady = 'true';\n");
  writeFile(join(extensionRoot, 'dist/static/style.css'), 'body { font: 13px system-ui; margin: 0; }\n');
}

function startReadyChild({ stateRoot, entryPath, label, env = {} }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entryPath], {
      cwd: repoRoot,
      env: { ...process.env, NEON_PILOT_STATE_ROOT: stateRoot, ...env },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const stderr = [];
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${label} startup timed out.\n${stderr.join('')}`));
    }, 20_000);
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr.push(text);
      process.stderr.write(text);
    });
    child.on('message', (message) => {
      if (message?.type === 'ready') {
        clearTimeout(timeout);
        resolve({ child, port: message.port, token: message.token });
      } else if (message?.type === 'fatal') {
        clearTimeout(timeout);
        reject(new Error(message.error));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`${label} exited before ready with code ${code ?? 'unknown'}.\n${stderr.join('')}`));
    });
  });
}

function stopReadyChild(child) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve();
    }, 5_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.send?.({ type: 'shutdown' });
  });
}

function requestUrl(url, options = {}) {
  const parsed = new URL(url);
  const useHttps = parsed.protocol === 'https:';
  const client = useHttps ? https : http;
  const body = options.body === undefined ? undefined : Buffer.from(options.body);
  const headers = { ...(options.headers ?? {}) };
  if (options.connectToLoopback) headers.host = parsed.host;
  if (body && !headers['content-length'] && !headers['Content-Length']) headers['content-length'] = String(body.byteLength);

  return new Promise((resolve, reject) => {
    const request = client.request(
      {
        hostname: options.connectToLoopback ? '127.0.0.1' : parsed.hostname,
        port: Number(parsed.port || (useHttps ? 443 : 80)),
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method ?? 'GET',
        headers,
        ...(useHttps
          ? {
              rejectUnauthorized: false,
              servername: parsed.hostname,
            }
          : {}),
      },
      (response) => {
        const chunks = [];
        const peerCertificate = useHttps && response.socket ? response.socket.getPeerCertificate() : null;
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body: buffer.toString('utf8'),
            peerCertificate,
          });
        });
      },
    );
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function dispatch(backend, request) {
  const response = await requestUrl(`http://127.0.0.1:${backend.port}/dispatch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${backend.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ request }),
  });
  return {
    ...response,
    json: () => JSON.parse(response.body),
  };
}

function assertOkResponse(response, label) {
  assert(response.statusCode >= 200 && response.statusCode < 300, `${label} returned ${response.statusCode}: ${response.body}`);
}

async function main() {
  if (!existsSync(backendChildPath)) {
    fail(`Missing ${backendChildPath}. Run pnpm --dir packages/desktop run build:main first.`);
  }
  if (!existsSync(extensionHostChildPath)) {
    fail(`Missing ${extensionHostChildPath}. Run pnpm --dir packages/desktop run build:main first.`);
  }

  const tempRoot = mkdtempSync('/tmp/neon-webapp-smoke-');
  const stateRoot = join(tempRoot, 'state');
  let backend = null;
  let extensionHost = null;
  let target = null;
  try {
    target = await createProxyTargetServer();
    createQaExtension(stateRoot, target.port);
    extensionHost = await startReadyChild({ stateRoot, entryPath: extensionHostChildPath, label: 'Extension host child' });
    backend = await startReadyChild({
      stateRoot,
      entryPath: backendChildPath,
      label: 'Backend child',
      env: {
        NEON_PILOT_EXTENSION_HOST_BASE_URL: `http://127.0.0.1:${extensionHost.port}`,
        NEON_PILOT_EXTENSION_HOST_TOKEN: extensionHost.token,
      },
    });

    const status = await dispatch(backend, { method: 'GET', path: '/api/extensions/webapps/localhost-proxy' });
    assertOkResponse(status, 'proxy status');
    const proxyStatus = status.json();
    assert(proxyStatus.running === true, 'localhost proxy did not report running.');
    assert(proxyStatus.https?.enabled === true, 'HTTPS listener was not enabled.');
    assert(proxyStatus.http?.enabled === true, 'HTTP listener was not enabled.');

    const webappsResponse = await dispatch(backend, { method: 'GET', path: '/api/extensions/webapps' });
    assertOkResponse(webappsResponse, 'webapp discovery');
    const webapps = webappsResponse.json();
    const staticWebapp = webapps.find((webapp) => webapp.extensionId === 'qa-webapp-sidecar' && webapp.id === 'static');
    const proxyWebapp = webapps.find((webapp) => webapp.extensionId === 'qa-webapp-sidecar' && webapp.id === 'proxy');
    assert(staticWebapp, 'static webapp was missing from discovery.');
    assert(proxyWebapp, 'proxy webapp was missing from discovery.');
    assert(staticWebapp.localhostName === 'static-qa-webapp-sidecar', `unexpected static localhostName: ${staticWebapp.localhostName}`);
    assert(proxyWebapp.localhostName === 'proxy-qa-webapp-sidecar', `unexpected proxy localhostName: ${proxyWebapp.localhostName}`);
    assert(!('portlessName' in staticWebapp), 'discovery leaked portlessName.');
    assert(!('portlessUrl' in staticWebapp), 'discovery leaked portlessUrl.');

    const staticRoot = await requestUrl(staticWebapp.localhostUrl, { connectToLoopback: true });
    assertOkResponse(staticRoot, 'static webapp root');
    assert(staticRoot.headers['x-neon-pilot-localhost-proxy'] === '1', 'static response did not come through localhost proxy.');
    assert(staticRoot.body.includes('Static QA Sidecar'), 'static root did not return the test HTML.');
    const certNameError = tls.checkServerIdentity(new URL(staticWebapp.localhostUrl).hostname, staticRoot.peerCertificate);
    assert(!certNameError, `generated certificate does not match default localhostName: ${certNameError?.message ?? ''}`);

    const staticAsset = await requestUrl(new URL('/app.js', staticWebapp.localhostUrl).toString(), { connectToLoopback: true });
    assertOkResponse(staticAsset, 'static webapp asset');
    assert(staticAsset.body.includes('sidecarReady'), 'static asset did not load through the sidecar proxy.');

    const spaFallback = await requestUrl(new URL('/nested/workspace/route', staticWebapp.localhostUrl).toString(), {
      connectToLoopback: true,
    });
    assertOkResponse(spaFallback, 'static webapp SPA fallback');
    assert(spaFallback.body.includes('Static QA Sidecar'), 'SPA fallback did not return the entry HTML.');

    const httpUrl = new URL(staticWebapp.localhostUrl);
    httpUrl.protocol = 'http:';
    httpUrl.port = String(proxyStatus.http.port);
    const redirect = await requestUrl(httpUrl.toString(), { connectToLoopback: true });
    assert(redirect.statusCode === 302, `HTTP listener did not redirect to HTTPS: ${redirect.statusCode}`);
    assert(
      String(redirect.headers.location ?? '').startsWith('https://static-qa-webapp-sidecar.localhost'),
      'HTTP redirect location was wrong.',
    );

    const proxyPage = await requestUrl(new URL('/live', proxyWebapp.localhostUrl).toString(), { connectToLoopback: true });
    assertOkResponse(proxyPage, 'proxy webapp page');
    assert(proxyPage.body.includes('Loopback Sidecar'), 'proxy webapp did not return the target page.');

    const echo = await requestUrl(new URL('/echo?from=smoke', proxyWebapp.localhostUrl).toString(), {
      connectToLoopback: true,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });
    assertOkResponse(echo, 'proxy webapp POST');
    const echoBody = JSON.parse(echo.body);
    assert(echoBody.method === 'POST', 'proxy target did not receive POST.');
    assert(echoBody.url === '/echo?from=smoke', `proxy target received wrong URL: ${echoBody.url}`);
    assert(echoBody.body === JSON.stringify({ ok: true }), 'proxy target received wrong body.');

    console.log(
      JSON.stringify(
        {
          ok: true,
          stateRoot,
          webapps: [
            { id: staticWebapp.id, localhostName: staticWebapp.localhostName, localhostUrl: staticWebapp.localhostUrl },
            { id: proxyWebapp.id, localhostName: proxyWebapp.localhostName, localhostUrl: proxyWebapp.localhostUrl },
          ],
          proxy: {
            httpsPort: proxyStatus.https.port,
            httpPort: proxyStatus.http.port,
            defaultPort: proxyStatus.urls.defaultPort,
          },
        },
        null,
        2,
      ),
    );
    if (Number.isFinite(holdMs) && holdMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, holdMs));
    }
  } finally {
    if (backend) await stopReadyChild(backend.child);
    if (extensionHost) await stopReadyChild(extensionHost.child);
    if (target) await closeServer(target.server);
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
