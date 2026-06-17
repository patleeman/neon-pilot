import './style.css';

type WebappSummary = {
  id: string;
  extensionId: string;
  title: string;
  description?: string;
  localhostUrl?: string;
  directUrl?: string | null;
};

const preferredOrder = new Map([
  ['system-excalidraw-input:drawing', 0],
  ['system-scratchpad:scratchpad', 1],
]);

function byPreferredOrder(left: WebappSummary, right: WebappSummary): number {
  const leftKey = `${left.extensionId}:${left.id}`;
  const rightKey = `${right.extensionId}:${right.id}`;
  const leftRank = preferredOrder.get(leftKey) ?? 100;
  const rightRank = preferredOrder.get(rightKey) ?? 100;
  return leftRank - rightRank || left.title.localeCompare(right.title);
}

function iconFor(webapp: WebappSummary): string {
  if (webapp.extensionId === 'system-excalidraw-input') return '*';
  if (webapp.extensionId === 'system-scratchpad') return '[]';
  return '>';
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

function renderError(message: string) {
  const tiles = document.querySelector<HTMLDivElement>('#tiles');
  const status = document.querySelector<HTMLDivElement>('#status');
  if (status) status.textContent = 'Unavailable';
  if (tiles) {
    tiles.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'empty';
    item.textContent = message;
    tiles.append(item);
  }
}

function renderTiles(webapps: WebappSummary[]) {
  const tiles = document.querySelector<HTMLDivElement>('#tiles');
  if (!tiles) return;
  tiles.innerHTML = '';

  const sidecars = webapps
    .filter((webapp) => preferredOrder.has(`${webapp.extensionId}:${webapp.id}`))
    .sort(byPreferredOrder);

  if (sidecars.length === 0) {
    const item = document.createElement('div');
    item.className = 'empty';
    item.textContent = 'No Codex sidecars are registered.';
    tiles.append(item);
    return;
  }

  for (const webapp of sidecars) {
    const href = webapp.localhostUrl || webapp.directUrl || '#';
    const link = document.createElement('a');
    link.className = 'tile';
    link.href = href;
    link.innerHTML = [
      `<span class="tile-icon" aria-hidden="true">${iconFor(webapp)}</span>`,
      '<span class="tile-text">',
      `<span class="tile-title">${webapp.title}</span>`,
      webapp.description ? `<span class="tile-description">${webapp.description}</span>` : '',
      '</span>',
    ].join('');
    tiles.append(link);
  }
}

async function refresh() {
  const status = document.querySelector<HTMLDivElement>('#status');
  if (status) status.textContent = 'Loading sidecars...';
  try {
    const [webapps, proxy] = await Promise.all([
      readJson<WebappSummary[]>('/.neon/api/extensions/webapps'),
      readJson<{ running?: boolean; urls?: { scheme?: string }; https?: { enabled?: boolean; port?: number } }>(
        '/.neon/api/extensions/webapps/localhost-proxy',
      ).catch(() => null),
    ]);
    const scheme = proxy?.urls?.scheme ?? 'https';
    const port = proxy?.https?.enabled && proxy.https.port && proxy.https.port !== 443 ? `:${proxy.https.port}` : '';
    if (status) status.textContent = proxy?.running ? `${scheme.toUpperCase()} local sidecars${port}` : 'Local sidecar proxy not running';
    renderTiles(webapps);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  }
}

document.querySelector('#refresh')?.addEventListener('click', () => void refresh());
void refresh();
