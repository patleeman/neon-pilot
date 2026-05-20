import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';

import type { ExtensionBackendContext } from '@neon-pilot/extensions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProbeVideoInput {
  path?: unknown;
  question?: unknown;
}

interface VideoProbeSettings {
  backend: 'openrouter' | 'local';
  openrouterModel: string;
  localModel: string;
  localBaseUrl: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const DEFAULTS: VideoProbeSettings = {
  backend: 'openrouter',
  openrouterModel: 'google/gemini-2.5-flash',
  localModel: 'mlx-community/Nemotron-3-Nano-Omni-30B-A3B-Reasoning-nvfp4',
  localBaseUrl: 'http://localhost:8000',
};

function readVideoProbeSettings(settingsFile: string): VideoProbeSettings {
  if (!existsSync(settingsFile)) {
    return { ...DEFAULTS };
  }

  try {
    const root = JSON.parse(readFileSync(settingsFile, 'utf8')) as Record<string, unknown>;
    const raw = root.videoProbe as Partial<VideoProbeSettings> | undefined;
    return {
      backend: raw?.backend === 'local' ? 'local' : 'openrouter',
      openrouterModel:
        typeof raw?.openrouterModel === 'string' && raw.openrouterModel.trim() ? raw.openrouterModel.trim() : DEFAULTS.openrouterModel,
      localModel: typeof raw?.localModel === 'string' && raw.localModel.trim() ? raw.localModel.trim() : DEFAULTS.localModel,
      localBaseUrl:
        typeof raw?.localBaseUrl === 'string' && raw.localBaseUrl.trim()
          ? raw.localBaseUrl.trim().replace(/\/+$/, '')
          : DEFAULTS.localBaseUrl,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mpg', '.mpeg', '.m4v', '.3gp', '.wmv', '.flv']);

function readPath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('probe_video requires a path to a video file.');
  const p = value.trim();
  if (!existsSync(p)) throw new Error(`Video file not found: ${p}`);
  const ext = extname(p).toLowerCase();
  if (ext && !SUPPORTED_EXTENSIONS.has(ext))
    throw new Error(`Unsupported video format: ${ext}. Supported: ${[...SUPPORTED_EXTENSIONS].join(', ')}`);
  return p;
}

function readQuestion(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('probe_video requires a question.');
  if (value.length > 8000) throw new Error('Question is too long (max 8000 characters).');
  return value.trim();
}

// ---------------------------------------------------------------------------
// MIME type helper
// ---------------------------------------------------------------------------

function videoMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.mpg': 'video/mpeg',
    '.mpeg': 'video/mpeg',
    '.m4v': 'video/mp4',
    '.3gp': 'video/3gpp',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
  };
  return map[ext] ?? 'video/mp4';
}

// ---------------------------------------------------------------------------
// OpenRouter backend
// ---------------------------------------------------------------------------

async function probeViaOpenRouter(input: {
  filePath: string;
  question: string;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<string> {
  const videoData = readFileSync(input.filePath);
  const base64 = videoData.toString('base64');
  const mimeType = videoMimeType(input.filePath);

  const body = {
    model: input.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'video_url',
            video_url: { url: `data:${mimeType};base64,${base64}` },
          },
          {
            type: 'text',
            text: input.question,
          },
        ],
      },
    ],
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/neon-pilot/personal-agent',
      'X-Title': 'Personal Agent Video Probe',
    },
    body: JSON.stringify(body),
    signal: input.signal,
  });

  const responseText = await response.text();

  if (!response.ok) {
    let message = `OpenRouter error ${response.status}`;
    try {
      const parsed = JSON.parse(responseText) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const parsed = JSON.parse(responseText) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (parsed.error?.message) throw new Error(parsed.error.message);

  const text = parsed.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenRouter returned an empty response.');
  return text;
}

// ---------------------------------------------------------------------------
// Local mlx-vlm backend
// ---------------------------------------------------------------------------

async function probeViaLocal(input: {
  filePath: string;
  question: string;
  model: string;
  baseUrl: string;
  signal?: AbortSignal;
}): Promise<string> {
  // mlx-vlm server exposes an OpenAI-compat /v1/chat/completions endpoint.
  // Video is passed as a video_url content part (same shape as OpenRouter).
  const videoData = readFileSync(input.filePath);
  const base64 = videoData.toString('base64');
  const mimeType = videoMimeType(input.filePath);

  const body = {
    model: input.model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'video_url',
            video_url: { url: `data:${mimeType};base64,${base64}` },
          },
          {
            type: 'text',
            text: input.question,
          },
        ],
      },
    ],
  };

  const endpoint = `${input.baseUrl}/v1/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: input.signal,
  });

  const responseText = await response.text();

  if (!response.ok) {
    let message = `mlx-vlm server error ${response.status}`;
    try {
      const parsed = JSON.parse(responseText) as { error?: { message?: string } | string };
      if (typeof parsed.error === 'string') message = parsed.error;
      else if (parsed.error?.message) message = parsed.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const parsed = JSON.parse(responseText) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (parsed.error?.message) throw new Error(parsed.error.message);

  const text = parsed.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('mlx-vlm server returned an empty response.');
  return text;
}

// ---------------------------------------------------------------------------
// Error classifier
// ---------------------------------------------------------------------------

function classifyError(error: unknown, backend: string, modelRef: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (/(402|insufficient\s+(balance|credits|funds|quota)|payment required|billing)/.test(normalized)) {
    return `Video probe failed — the provider reported a billing or credit problem. Check your account. Backend: ${backend}, model: ${modelRef}. Error: ${message}`;
  }
  if (/(does not support|not support|video|unsupported|video_url)/.test(normalized)) {
    return `Video probe failed — the model may not support video input. Try a different model. Backend: ${backend}, model: ${modelRef}. Error: ${message}`;
  }
  if (/(too large|413|payload|size limit|content_too_large)/.test(normalized)) {
    return `Video probe failed — the video file is too large for this model/backend. Try a shorter clip. Backend: ${backend}, model: ${modelRef}. Error: ${message}`;
  }
  if (/(connection refused|econnrefused|fetch failed|network|enotfound)/.test(normalized)) {
    if (backend === 'local') {
      return `Video probe failed — could not connect to mlx-vlm server at the configured URL. Make sure the server is running:\n\npython -m mlx_vlm.server --model ${modelRef}\n\nError: ${message}`;
    }
    return `Video probe failed — network error reaching ${backend}. Error: ${message}`;
  }

  return `Video probe failed. Backend: ${backend}, model: ${modelRef}. Error: ${message}`;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function probeVideo(input: ProbeVideoInput, ctx: ExtensionBackendContext) {
  const filePath = readPath(input.path);
  const question = readQuestion(input.question);
  const settings = readVideoProbeSettings(ctx.profileSettingsFilePath);

  let text: string;

  try {
    if (settings.backend === 'local') {
      text = await probeViaLocal({
        filePath,
        question,
        model: settings.localModel,
        baseUrl: settings.localBaseUrl,
        signal: ctx.signal,
      });
    } else {
      const apiKey = (await ctx.secrets.get('openrouterApiKey'))?.trim();
      if (!apiKey) throw new Error('No OpenRouter API key configured. Add one in Settings → Video Probe.');

      text = await probeViaOpenRouter({
        filePath,
        question,
        model: settings.openrouterModel,
        apiKey,
        signal: ctx.signal,
      });
    }
  } catch (error) {
    const modelRef = settings.backend === 'local' ? settings.localModel : settings.openrouterModel;
    const friendly = classifyError(error, settings.backend, modelRef);
    return {
      text: friendly,
      content: [{ type: 'text' as const, text: friendly }],
      isError: true,
    };
  }

  return {
    text,
    content: [{ type: 'text' as const, text }],
    details: {
      backend: settings.backend,
      model: settings.backend === 'local' ? settings.localModel : settings.openrouterModel,
      filePath,
    },
  };
}
