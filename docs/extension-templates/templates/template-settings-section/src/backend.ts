import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// Shape of this extension's settings.
export interface MySettings {
  apiKey: string;
  endpoint: string;
  enabled: boolean;
}

const defaultSettings: MySettings = {
  apiKey: '',
  endpoint: 'https://api.example.com',
  enabled: false,
};

// In-memory store — replace with ctx.settings or a sqlite store for persistence.
// ctx.settings.get / ctx.settings.set are the preferred pattern for simple key-value settings.
let stored: MySettings = { ...defaultSettings };

export async function loadSettings(_input: unknown, _ctx: ExtensionBackendContext): Promise<MySettings> {
  // Example with ctx.settings (preferred for simple values):
  //   const apiKey = (await ctx.settings.get('apiKey')) as string ?? '';
  //   return { ...defaultSettings, apiKey };
  return { ...stored };
}

export async function saveSettings(input: unknown, _ctx: ExtensionBackendContext): Promise<{ ok: boolean; settings: MySettings }> {
  const incoming = input as Partial<MySettings>;
  stored = {
    apiKey: typeof incoming.apiKey === 'string' ? incoming.apiKey : stored.apiKey,
    endpoint: typeof incoming.endpoint === 'string' ? incoming.endpoint : stored.endpoint,
    enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : stored.enabled,
  };
  // Example with ctx.settings:
  //   if (typeof incoming.apiKey === 'string') await ctx.settings.set('apiKey', incoming.apiKey);
  return { ok: true, settings: { ...stored } };
}
