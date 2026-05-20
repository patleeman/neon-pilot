import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// Shape of one row returned to the frontend.
export interface Item {
  id: string;
  name: string;
  status: 'ok' | 'warn' | 'error';
  updatedAt: string; // ISO timestamp
  detail: string;
}

// Backend action wired to "myDashboardLoad" in extension.json.
// Replace this with your real data source (fs, sqlite, network, daemon API, etc.).
export async function load(_input: unknown, _ctx: ExtensionBackendContext): Promise<{ items: Item[] }> {
  // Example: return hard-coded placeholder data.
  // In practice: query a DB, call an OS API, read a file, etc.
  const items: Item[] = [
    { id: '1', name: 'Alpha service', status: 'ok', updatedAt: new Date().toISOString(), detail: 'All good' },
    { id: '2', name: 'Beta service', status: 'warn', updatedAt: new Date().toISOString(), detail: 'High latency' },
    { id: '3', name: 'Gamma service', status: 'error', updatedAt: new Date().toISOString(), detail: 'Connection refused' },
  ];
  return { items };
}
