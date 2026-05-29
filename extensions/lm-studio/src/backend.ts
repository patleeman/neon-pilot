import type { ExtensionBackendContext } from '@neon-pilot/extensions';
import { readExtensionSettings } from '@neon-pilot/extensions/backend/settings';

interface LmStudioModelResponse {
  object: string;
  data: Array<{ id: string; object: string; created: number; owned_by: string }>;
}

interface DiscoveredModelEntry {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<'text' | 'image'>;
  contextWindow: number;
}

interface DiscoveredProvider {
  provider: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  models: DiscoveredModelEntry[];
}

const CACHE_KEY = 'cached_models';

async function readSettings(): Promise<{
  baseUrl: string;
  contextWindow: number;
  maxTokens: number;
}> {
  const settings = await readExtensionSettings();
  return {
    baseUrl: (settings['lmStudio.baseUrl'] as string) ?? 'http://localhost:1234',
    contextWindow: (settings['lmStudio.contextWindow'] as number) ?? 32768,
    maxTokens: (settings['lmStudio.maxTokens'] as number) ?? 4096,
  };
}

async function fetchLmStudioModels(baseUrl: string): Promise<{ id: string; name: string }[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/v1/models`;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

  if (!response.ok) {
    throw new Error(`LM Studio API returned ${response.status}: ${response.statusText}`);
  }

  const body = (await response.json()) as LmStudioModelResponse;
  if (!body?.data || !Array.isArray(body.data)) {
    throw new Error('Unexpected response format from LM Studio');
  }

  return body.data
    .filter((m) => m.id && typeof m.id === 'string')
    .map((m) => ({
      id: m.id,
      name: m.id,
    }));
}

/**
 * Model discovery action — called by the runtime on every `/api/models` query.
 *
 * Probes the configured LM Studio instance and returns live model info.
 * Returns `null` when LM Studio is unreachable so it doesn't block the picker.
 */
export async function discoverModels(_input: unknown, _ctx: ExtensionBackendContext): Promise<DiscoveredProvider | null> {
  let settings: { baseUrl: string; contextWindow: number; maxTokens: number };
  try {
    settings = await readSettings();
  } catch {
    return null;
  }

  let models: { id: string; name: string }[];
  try {
    models = await fetchLmStudioModels(settings.baseUrl);
  } catch {
    // LM Studio not reachable — silently skip discovery
    return null;
  }

  if (models.length === 0) return null;

  return {
    provider: 'lm-studio',
    baseUrl: settings.baseUrl,
    api: 'openai-completions',
    apiKey: 'unused',
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: false,
      input: ['text'],
      contextWindow: settings.contextWindow,
    })),
  };
}

/**
 * Check LM Studio connection status and return discovered models.
 */
export async function getStatus(_input: unknown, ctx: ExtensionBackendContext) {
  const settings = await readSettings();
  const baseUrl = settings.baseUrl.replace(/\/+$/, '');

  let reachable = false;
  let models: { id: string; name: string }[] = [];
  let error: string | null = null;

  try {
    models = await fetchLmStudioModels(baseUrl);
    reachable = true;
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  // Cache the last known models for offline display
  if (reachable && models.length > 0) {
    await ctx.storage.put(CACHE_KEY, models);
  }

  return {
    reachable,
    baseUrl,
    models,
    error,
  };
}

/**
 * Force-refresh the cached model list (triggered from the UI).
 */
export async function refreshModels(_input: unknown, ctx: ExtensionBackendContext) {
  const settings = await readSettings();
  const baseUrl = settings.baseUrl.replace(/\/+$/, '');

  try {
    const models = await fetchLmStudioModels(baseUrl);
    await ctx.storage.put(CACHE_KEY, models);
    return { ok: true, models };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
