import type { ExtensionBackendContext } from '@neon-pilot/extensions';

import * as gguf from '../../shared/local-model-runtimes/gguf';
import * as mlx from '../../shared/local-model-runtimes/mlx';

type SearchInput = { query?: string; format?: 'all' | 'mlx' | 'gguf'; limit?: number };
type DetailsInput = { modelId?: string };

export async function status(input: unknown, ctx: ExtensionBackendContext) {
  const [mlxStatus, ggufStatus] = await Promise.all([mlx.status(input, ctx), gguf.runtimeStatus(input, ctx)]);
  return { ok: true, mlx: mlxStatus, gguf: ggufStatus };
}

export async function mlxSetModel(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.setModel(input, ctx);
}

export async function mlxSetup(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.setup(input, ctx);
}

export async function mlxUpdateRuntime(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.updateRuntime(input, ctx);
}

export async function mlxStart(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.start(input, ctx);
}

export async function mlxStop(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.stop(input, ctx);
}

export async function mlxSearch(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.searchModels(input, ctx);
}

export async function searchModels(input: SearchInput) {
  const query = input.query?.trim();
  if (!query) return { ok: true, models: [] };

  const format = input.format ?? 'all';
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const search = format === 'all' ? query : `${query} ${format}`;
  const params = new URLSearchParams({ search, limit: String(limit), sort: 'downloads', direction: '-1' });
  if (format === 'mlx') params.set('filter', 'mlx');
  if (format === 'gguf') params.set('search', `${query} GGUF`);

  const response = await fetch(`https://huggingface.co/api/models?${params.toString()}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Hugging Face search failed: ${response.status}`);
  const body = (await response.json()) as Array<{
    id?: string;
    modelId?: string;
    downloads?: number;
    likes?: number;
    tags?: string[];
    pipeline_tag?: string;
    lastModified?: string;
  }>;

  return {
    ok: true,
    models: body
      .map((model) => {
        const id = model.id ?? model.modelId ?? '';
        const tags = model.tags ?? [];
        const lower = `${id} ${tags.join(' ')}`.toLowerCase();
        const detectedFormat = lower.includes('gguf') ? 'gguf' : lower.includes('mlx') ? 'mlx' : 'unknown';
        return {
          id,
          title: id.split('/').pop() || id,
          downloads: model.downloads ?? 0,
          likes: model.likes ?? 0,
          tags,
          format: detectedFormat,
          pipelineTag: model.pipeline_tag,
          lastModified: model.lastModified,
        };
      })
      .filter((model) => model.id),
  };
}

export async function modelDetails(input: DetailsInput) {
  const modelId = input.modelId?.trim();
  if (!modelId) throw new Error('modelId is required.');

  const encodedModelPath = modelId.split('/').map(encodeURIComponent).join('/');
  const infoResponse = await fetch(`https://huggingface.co/api/models/${encodedModelPath}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!infoResponse.ok) throw new Error(`Hugging Face model details failed: ${infoResponse.status}`);
  const info = (await infoResponse.json()) as {
    id?: string;
    modelId?: string;
    downloads?: number;
    likes?: number;
    tags?: string[];
    cardData?: unknown;
    siblings?: Array<{ rfilename?: string; size?: number }>;
    lastModified?: string;
  };

  let readme = '';
  try {
    const readmeResponse = await fetch(`https://huggingface.co/${encodedModelPath}/raw/main/README.md`, {
      signal: AbortSignal.timeout(8000),
    });
    if (readmeResponse.ok) readme = (await readmeResponse.text()).slice(0, 12000);
  } catch {
    // README is best-effort metadata for the details drawer.
  }

  return {
    ok: true,
    model: {
      id: info.id ?? info.modelId ?? modelId,
      downloads: info.downloads ?? 0,
      likes: info.likes ?? 0,
      tags: info.tags ?? [],
      lastModified: info.lastModified,
      cardData: info.cardData,
      files: (info.siblings ?? []).map((file) => ({ name: file.rfilename ?? '', size: file.size })).filter((file) => file.name),
      readme,
    },
  };
}

export async function ggufDownload(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.downloadModel(input as never, ctx);
}

export async function ggufCancelDownload(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.cancelDownload(input, ctx);
}

export async function ggufSetModel(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.setModel(input as never, ctx);
}

export async function mlxDelete(input: unknown, ctx: ExtensionBackendContext) {
  return mlx.deleteModel(input, ctx);
}

export async function ggufReveal(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.revealModel(input as never, ctx);
}

export async function ggufDelete(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.deleteModel(input as never, ctx);
}

export async function ggufInstallRuntime(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.installRuntime(input, ctx);
}

export async function ggufSaveSettings(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.saveSettings(input, ctx);
}

export async function ggufStart(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.startServer(input as never, ctx);
}

export async function ggufStop(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.stopServer(input, ctx);
}

export async function stopAll(input: unknown, ctx: ExtensionBackendContext) {
  await Promise.allSettled([mlx.stop(input, ctx), gguf.stopServer(input, ctx), gguf.cancelDownload(input, ctx)]);
  return { ok: true, status: await status(input, ctx) };
}

export async function toggleServer(input: unknown, ctx: ExtensionBackendContext) {
  const current = await status(input, ctx);
  if (
    current.mlx.server.reachable ||
    current.gguf.server.reachable ||
    current.mlx.process.managedRunning ||
    current.gguf.process.managedRunning
  ) {
    await stopAll(input, ctx);
    return { ok: true, running: false, status: await status(input, ctx) };
  }

  if (
    current.gguf.selectedModelPath &&
    current.gguf.models.some((model: { path: string }) => model.path === current.gguf.selectedModelPath)
  ) {
    const result = await gguf.startServer({ modelPath: current.gguf.selectedModelPath }, ctx);
    return { ok: true, running: true, result, status: await status(input, ctx) };
  }

  if (current.mlx.installed) {
    const result = await mlx.start({}, ctx);
    return { ok: true, running: true, result, status: await status(input, ctx) };
  }

  throw new Error('Download or select a local model before starting the local model server.');
}

export async function ggufSetServerEnabled(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.setServerEnabled(input, ctx);
}

export async function ggufRunPrompt(input: unknown, ctx: ExtensionBackendContext) {
  return gguf.runPrompt(input as never, ctx);
}

/**
 * Model discovery action — called by the desktop server at model-list query time.
 * Probes local runtimes and returns a provider descriptor if any are reachable,
 * or null if nothing is running. MLX takes priority over GGUF.
 */
export async function localModelsDiscover(_input: unknown, ctx: ExtensionBackendContext) {
  const [mlxStatus, ggufStatus] = await Promise.all([mlx.status({}, ctx), gguf.runtimeStatus({}, ctx)]);

  const MLX_BASE_URL = 'http://127.0.0.1:8011/v1';
  const GGUF_BASE_URL = ggufStatus.baseUrl || 'http://127.0.0.1:8012/v1';

  if (mlxStatus.server.reachable && mlxStatus.server.models.length > 0) {
    const modelId = mlxStatus.loadedModelId || mlxStatus.selectedModelId;
    return {
      provider: 'local',
      baseUrl: MLX_BASE_URL,
      api: 'openai-completions',
      apiKey: 'local',
      models: [
        {
          id: modelId,
          name: modelId.split('/').pop() || modelId,
          reasoning: true,
          input: ['text'],
          contextWindow: mlxStatus.recommendedContextSize || 32768,
        },
      ],
    };
  }

  if (ggufStatus.server.reachable && ggufStatus.server.models.length > 0) {
    const ggufSelected =
      ggufStatus.models.find((model: { path: string; name: string }) => model.path === ggufStatus.selectedModelPath) ?? null;
    if (!ggufSelected) return null;
    return {
      provider: 'local',
      baseUrl: GGUF_BASE_URL,
      api: 'openai-completions',
      apiKey: 'local',
      models: [
        {
          id: ggufSelected.name,
          name: ggufSelected.name,
          reasoning: true,
          input: ['text'],
          contextWindow: ggufStatus.recommendedContextSize || 32768,
        },
      ],
    };
  }

  return null;
}
