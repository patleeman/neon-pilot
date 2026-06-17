import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import {
  stream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEvent,
  type Context,
  type ImageContent,
  type Message,
  type Model,
  type TextContent,
  Type,
} from '@earendil-works/pi-ai';

import { readSavedModelRef } from './models/modelPreferences.js';

export const DEFAULT_MODEL_GATEWAY_PORT = 8766;
export const FAKE_MODEL_GATEWAY_MODEL_ID = 'neon-pilot-fake';
export const DEFAULT_MODEL_GATEWAY_MODEL_ID = 'auto';

export interface ModelGatewaySettings {
  port: number;
  host: string;
  defaultModel: string;
  authToken: string;
}

export interface ModelGatewayModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  name?: string;
  context_window?: number;
  input_modalities?: string[];
}

export interface ModelGatewayStatus {
  running: boolean;
  host: string;
  port: number;
  baseUrl: string;
  authToken: string;
  models: number;
  defaultModel: string;
  catalogPath?: string;
  lastError?: string;
}

export interface ModelGatewayResponseOptions {
  signal?: AbortSignal;
}

export interface ResponsesRequest {
  model?: unknown;
  input?: unknown;
  instructions?: unknown;
  tools?: unknown;
  stream?: unknown;
  temperature?: unknown;
  max_output_tokens?: unknown;
  reasoning?: unknown;
  metadata?: unknown;
}

export interface ResponsesResponse {
  id: string;
  object: 'response';
  created_at: number;
  status: 'completed' | 'failed';
  model: string;
  output: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
  error?: { message: string };
}

type RuntimeContext = {
  runtimeDir: string;
};

const MODEL_GATEWAY_PLAN_TIERS = ['free', 'plus', 'pro', 'team', 'business', 'enterprise'];
const PRIVATE_FILE_MODE = 0o600;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function responseId(): string {
  return `resp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(readText).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record.type === 'input_image' || record.type === 'image_url') return '[image]';
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
    if (record.content !== undefined) return readText(record.content);
    if (record.output !== undefined) return readText(record.output);
  }
  return '';
}

function imageContentFromUrl(url: unknown): ImageContent | null {
  if (typeof url !== 'string') return null;
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(url);
  if (!match) return null;
  return { type: 'image', mimeType: match[1]!, data: match[2]! };
}

function readContentBlocks(value: unknown): string | Array<TextContent | ImageContent> {
  if (typeof value === 'string') return value;
  const blocks: Array<TextContent | ImageContent> = [];
  const visit = (part: unknown): void => {
    if (typeof part === 'string') {
      if (part) blocks.push({ type: 'text', text: part });
      return;
    }
    if (Array.isArray(part)) {
      for (const item of part) visit(item);
      return;
    }
    if (!part || typeof part !== 'object') return;
    const record = part as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type : '';
    if (type === 'input_text' || type === 'output_text' || type === 'text') {
      const text = typeof record.text === 'string' ? record.text : '';
      if (text) blocks.push({ type: 'text', text });
      return;
    }
    if (type === 'input_image' || type === 'image_url' || record.image_url !== undefined) {
      const imageUrl =
        typeof record.image_url === 'string'
          ? record.image_url
          : record.image_url && typeof record.image_url === 'object'
            ? (record.image_url as Record<string, unknown>).url
            : record.url;
      const image = imageContentFromUrl(imageUrl);
      blocks.push(image ?? { type: 'text', text: '[image]' });
      return;
    }
    if (record.output !== undefined) {
      visit(record.output);
      return;
    }
    if (record.content !== undefined) visit(record.content);
  };
  visit(value);
  const textBlocks = blocks.filter((block) => block.type === 'text');
  if (textBlocks.length === blocks.length) return textBlocks.map((block) => block.text).filter(Boolean).join('\n');
  return blocks;
}

function readToolResultContent(value: unknown): Array<TextContent | ImageContent> {
  const content = readContentBlocks(value);
  return Array.isArray(content) ? content : [{ type: 'text', text: content }];
}

function normalizeToolParameters(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { type: 'object', properties: {} };
}

function nativeToolFallback(toolType: string): { name: string; description: string; parameters: Record<string, unknown> } | null {
  if (toolType === 'computer_use' || toolType === 'computer_use_preview') {
    return {
      name: 'computer_use',
      description: 'Request a computer action.',
      parameters: {
        type: 'object',
        properties: { action: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' }, text: { type: 'string' } },
        required: ['action'],
      },
    };
  }
  if (toolType === 'web_search' || toolType === 'web_search_preview') {
    return {
      name: 'web_search',
      description: 'Search the web.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    };
  }
  if (toolType === 'apply_patch') {
    return {
      name: 'apply_patch',
      description: 'Apply a patch.',
      parameters: { type: 'object', properties: { patch: { type: 'string' } }, required: ['patch'] },
    };
  }
  if (toolType === 'local_shell' || toolType === 'shell') {
    return {
      name: toolType,
      description: 'Run a local shell command.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    };
  }
  return null;
}

export function requestToolsToPiTools(tools: unknown): Context['tools'] {
  if (!Array.isArray(tools)) return undefined;
  const converted = tools
    .map((tool) => {
      if (!tool || typeof tool !== 'object') return null;
      const record = tool as Record<string, unknown>;
      const native = typeof record.type === 'string' ? nativeToolFallback(record.type) : null;
      if (native && !record.function && !record.name) return native;
      const fn = record.function && typeof record.function === 'object' ? (record.function as Record<string, unknown>) : record;
      const name = typeof fn.name === 'string' ? fn.name : '';
      if (!name) return null;
      return {
        name,
        description: typeof fn.description === 'string' ? fn.description : '',
        parameters: normalizeToolParameters(fn.parameters) as never,
      };
    })
    .filter((tool): tool is NonNullable<typeof tool> => tool !== null);
  return converted.length ? converted : undefined;
}

function parseFunctionCallArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function responsesInputToPiMessages(input: unknown): Message[] {
  if (typeof input === 'string') return [{ role: 'user', content: input, timestamp: Date.now() }];
  if (!Array.isArray(input)) return [{ role: 'user', content: readContentBlocks(input), timestamp: Date.now() }];

  const messages: Message[] = [];
  const pendingToolCalls = new Map<string, { id: string; name: string; arguments: Record<string, unknown> }>();
  const toolNamesByCallId = new Map<string, string>();
  const bufferedAssistantMessages: Message[] = [];
  const flushPendingToolCalls = (): void => {
    if (!pendingToolCalls.size) return;
    const calls = [...pendingToolCalls.values()];
    messages.push(...bufferedAssistantMessages);
    bufferedAssistantMessages.length = 0;
    messages.push({
      role: 'assistant',
      content: calls.map((call) => ({ type: 'toolCall', id: call.id, name: call.name, arguments: call.arguments })),
      api: 'openai-responses',
      provider: 'neon-pilot',
      model: 'replayed',
      usage: zeroUsage(),
      stopReason: 'toolUse',
      timestamp: Date.now(),
    });
    pendingToolCalls.clear();
  };
  for (const item of input) {
    if (typeof item === 'string') {
      flushPendingToolCalls();
      messages.push({ role: 'user', content: item, timestamp: Date.now() });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type : 'message';
    if (type === 'function_call') {
      const callId = String(record.call_id ?? record.id ?? '');
      const name = typeof record.name === 'string' ? record.name : '';
      if (!callId || !name) continue;
      toolNamesByCallId.set(callId, name);
      pendingToolCalls.set(callId, { id: callId, name, arguments: parseFunctionCallArguments(record.arguments) });
      continue;
    }
    if (type === 'function_call_output') {
      const callId = String(record.call_id ?? '');
      const pending = pendingToolCalls.get(callId);
      flushPendingToolCalls();
      messages.push({
        role: 'toolResult',
        toolCallId: callId,
        toolName: pending?.name ?? toolNamesByCallId.get(callId) ?? '',
        content: readToolResultContent(record.output),
        isError: false,
        timestamp: Date.now(),
      });
      continue;
    }
    if (type === 'computer_call_output') {
      flushPendingToolCalls();
      const callId = String(record.call_id ?? record.id ?? '');
      messages.push({
        role: 'toolResult',
        toolCallId: callId,
        toolName: 'computer_use',
        content: readToolResultContent(record.output),
        isError: false,
        timestamp: Date.now(),
      });
      continue;
    }
    if (type === 'input_text' || type === 'text' || type === 'input_image') {
      flushPendingToolCalls();
      messages.push({ role: 'user', content: readContentBlocks(record), timestamp: Date.now() });
      continue;
    }
    if (type === 'reasoning') {
      continue;
    }
    if (type === 'message' || record.role) {
      if (record.role === 'developer' || record.role === 'system') {
        flushPendingToolCalls();
        continue;
      }
      const role = record.role === 'assistant' ? 'assistant' : 'user';
      const content = readContentBlocks(record.content);
      const text = typeof content === 'string' ? content : content.filter((block) => block.type === 'text').map((block) => block.text).join('\n');
      if (role !== 'assistant') flushPendingToolCalls();
      if (role === 'assistant') {
        const assistantMessage: Message = {
          role: 'assistant',
          content: text ? [{ type: 'text', text }] : [],
          api: 'openai-responses',
          provider: 'neon-pilot',
          model: 'replayed',
          usage: zeroUsage(),
          stopReason: 'stop',
          timestamp: Date.now(),
        };
        if (pendingToolCalls.size > 0) {
          bufferedAssistantMessages.push(assistantMessage);
        } else {
          messages.push(assistantMessage);
        }
      } else {
        messages.push({ role: 'user', content, timestamp: Date.now() });
      }
    }
  }
  flushPendingToolCalls();
  return messages.length ? messages : [{ role: 'user', content: '', timestamp: Date.now() }];
}

function developerInstructionsFromResponsesInput(input: unknown): string {
  if (!Array.isArray(input)) return '';
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const record = item as Record<string, unknown>;
      const type = typeof record.type === 'string' ? record.type : 'message';
      return (type === 'message' || record.role) && (record.role === 'developer' || record.role === 'system') ? readText(record.content) : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function zeroUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function assistantMessageToOutput(message: AssistantMessage): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  let messageText = '';
  let reasoningText = '';
  for (const block of message.content) {
    if (block.type === 'text') messageText += block.text;
    if (block.type === 'thinking') reasoningText += block.thinking;
    if (block.type === 'toolCall') {
      output.push({
        id: block.id,
        type: 'function_call',
        status: 'completed',
        call_id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.arguments ?? {}),
      });
    }
  }
  if (reasoningText) {
    output.unshift({
      id: 'reasoning_0',
      type: 'reasoning',
      status: 'completed',
      summary: [{ type: 'summary_text', text: reasoningText }],
    });
  }
  if (messageText) {
    output.unshift({
      id: 'msg_0',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: messageText, annotations: [] }],
    });
  }
  return output;
}

function usageToResponsesUsage(message: AssistantMessage): Record<string, unknown> {
  return {
    input_tokens: message.usage.input,
    output_tokens: message.usage.output,
    total_tokens: message.usage.totalTokens,
    input_tokens_details: {
      cached_tokens: message.usage.cacheRead,
      cache_creation_input_tokens: message.usage.cacheWrite,
    },
  };
}

export function modelGatewaySettingsFrom(value: unknown): ModelGatewaySettings {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const rawPort = typeof record.port === 'number' ? record.port : DEFAULT_MODEL_GATEWAY_PORT;
  const port = Number.isSafeInteger(rawPort) && rawPort > 0 && rawPort < 65536 ? rawPort : DEFAULT_MODEL_GATEWAY_PORT;
  const host = typeof record.host === 'string' && record.host.trim() ? record.host.trim() : '127.0.0.1';
  const defaultModel = typeof record.defaultModel === 'string' && record.defaultModel.trim() ? record.defaultModel.trim() : DEFAULT_MODEL_GATEWAY_MODEL_ID;
  const authToken = typeof record.authToken === 'string' && record.authToken.trim() ? record.authToken.trim() : '';
  return { port, host, defaultModel, authToken };
}

export function parseModelRef(ref: string, models: Array<Model<Api>>): Model<Api> | null {
  const value = ref.trim();
  if (!value || value === DEFAULT_MODEL_GATEWAY_MODEL_ID) return models[0] ?? null;
  if (value.includes('/')) {
    const [provider, ...rest] = value.split('/');
    const modelId = rest.join('/');
    return models.find((model) => model.provider === provider && model.id === modelId) ?? null;
  }
  const exact = models.filter((model) => model.id === value);
  if (exact.length === 1) return exact[0] ?? null;
  return models.find((model) => `${model.provider}/${model.id}` === value) ?? null;
}

export function createModelRegistry(runtimeDir: string): ModelRegistry {
  return ModelRegistry.create(AuthStorage.create(`${runtimeDir}/auth.json`), `${runtimeDir}/models.json`);
}

export function listModelGatewayModels(ctx: RuntimeContext): ModelGatewayModel[] {
  const registry = createModelRegistry(ctx.runtimeDir);
  const created = nowSeconds();
  const models = registry.getAvailable();
  const entries = models.flatMap((model) => {
    const id = `${model.provider}/${model.id}`;
    const base = {
      object: 'model' as const,
      created,
      owned_by: model.provider,
      name: model.name,
      context_window: model.contextWindow,
      input_modalities: model.input,
    };
    return [
      { ...base, id },
      ...(models.filter((candidate) => candidate.id === model.id).length === 1
        ? [{ ...base, id: model.id }]
        : []),
    ];
  });
  entries.unshift({
    id: FAKE_MODEL_GATEWAY_MODEL_ID,
    object: 'model' as const,
    created,
    owned_by: 'neon-pilot',
    name: 'Neon Pilot Fake',
    context_window: 128_000,
    input_modalities: ['text'],
  });
  if (models.length)
    entries.unshift({
      id: DEFAULT_MODEL_GATEWAY_MODEL_ID,
      object: 'model' as const,
      created,
      owned_by: 'neon-pilot',
      name: 'Neon Pilot Auto',
      context_window: models[0]?.contextWindow,
      input_modalities: models[0]?.input,
    });
  return entries;
}

function displayNameForModel(model: ModelGatewayModel): string {
  if (model.name?.trim()) return model.name.trim();
  if (model.id === DEFAULT_MODEL_GATEWAY_MODEL_ID) return 'Neon Pilot Auto';
  if (model.id === FAKE_MODEL_GATEWAY_MODEL_ID) return 'Neon Pilot Fake';
  const { id } = model;
  const label = id.includes('/') ? id.split('/').slice(1).join('/') : id;
  return label
    .split(/[-_.:/]+/)
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)))
    .join(' ');
}

function catalogEntry(model: ModelGatewayModel, index: number): Record<string, unknown> {
  const displayName = displayNameForModel(model);
  const contextWindow = model.context_window ?? (model.id === DEFAULT_MODEL_GATEWAY_MODEL_ID ? 400_000 : 128_000);
  const inputModalities = model.input_modalities?.length ? model.input_modalities : ['text'];
  const priority = model.id === DEFAULT_MODEL_GATEWAY_MODEL_ID ? 0 : Math.max(1, index);
  return {
    slug: model.id,
    display_name: displayName,
    description: `${displayName} via Neon Pilot AI Gateway.`,
    context_window: contextWindow,
    max_context_window: contextWindow,
    auto_compact_token_limit: Math.max(8_000, Math.floor(contextWindow * 0.8)),
    truncation_policy: { mode: 'tokens', limit: Math.min(64_000, Math.max(8_000, Math.floor(contextWindow * 0.32))) },
    default_reasoning_level: 'medium',
    supported_reasoning_levels: [
      { effort: 'low', description: 'Faster, lighter reasoning' },
      { effort: 'medium', description: 'Balanced speed and reasoning' },
      { effort: 'high', description: 'Deeper reasoning' },
      { effort: 'xhigh', description: 'Maximum reasoning where supported' },
    ],
    default_reasoning_summary: 'none',
    reasoning_summary_format: 'none',
    supports_reasoning_summaries: false,
    default_verbosity: 'low',
    support_verbosity: false,
    apply_patch_tool_type: 'freeform',
    web_search_tool_type: 'text_and_image',
    supports_search_tool: false,
    supports_parallel_tool_calls: true,
    experimental_supported_tools: [],
    input_modalities: inputModalities,
    supports_image_detail_original: inputModalities.includes('image'),
    shell_type: 'shell_command',
    visibility: 'list',
    minimal_client_version: '0.0.1',
    supported_in_api: true,
    availability_nux: null,
    upgrade: null,
    priority,
    prefer_websockets: false,
    available_in_plans: MODEL_GATEWAY_PLAN_TIERS,
    base_instructions: 'You are a coding agent running through Neon Pilot AI Gateway.',
    model_messages: {
      instructions_template: 'You are running on {model_name} through Neon Pilot AI Gateway. Be a helpful, direct coding collaborator.',
      instructions_variables: { model_name: displayName },
    },
  };
}

export function modelGatewayCatalogPath(ctx: RuntimeContext): string {
  return join(ctx.runtimeDir, 'model-gateway', 'model-catalog.json');
}

export function writeModelGatewayCatalog(ctx: RuntimeContext): string {
  const path = modelGatewayCatalogPath(ctx);
  mkdirSync(join(ctx.runtimeDir, 'model-gateway'), { recursive: true });
  const models = listModelGatewayModels(ctx);
  writePrivateFile(path, `${JSON.stringify({ models: models.map(catalogEntry) }, null, 2)}\n`);
  return path;
}

function writePrivateFile(path: string, content: string): void {
  writeFileSync(path, content, { mode: PRIVATE_FILE_MODE });
  chmodSync(path, PRIVATE_FILE_MODE);
}

function resolveDefaultModelRef(ctx: RuntimeContext, models: Array<Model<Api>>): string {
  return readSavedModelRef(
    `${ctx.runtimeDir}/settings.json`,
    models.map((model) => ({ id: model.id, provider: model.provider })),
  );
}

function fakeResponse(body: ResponsesRequest, model: string): ResponsesResponse {
  const text = readText(body.input) || 'Hello from Neon Pilot AI Gateway.';
  return {
    id: responseId(),
    object: 'response',
    created_at: nowSeconds(),
    status: 'completed',
    model,
    output: [
      {
        id: 'msg_0',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text: `Gateway smoke OK: ${text}`, annotations: [] }],
      },
    ],
    usage: { input_tokens: 1, output_tokens: 4, total_tokens: 5 },
  };
}

async function resolveModel(ctx: RuntimeContext, modelRef: string): Promise<{ model: Model<Api>; apiKey?: string; headers?: Record<string, string> }> {
  const registry = createModelRegistry(ctx.runtimeDir);
  const models = registry.getAvailable();
  const resolvedRef = modelRef === DEFAULT_MODEL_GATEWAY_MODEL_ID ? resolveDefaultModelRef(ctx, models) || DEFAULT_MODEL_GATEWAY_MODEL_ID : modelRef;
  const model = parseModelRef(resolvedRef, models);
  if (!model) throw new Error(`Unknown or unavailable model: ${modelRef}`);
  const auth = await registry.getApiKeyAndHeaders(model);
  if (!auth.ok) throw new Error(auth.error);
  return { model, apiKey: auth.apiKey, headers: auth.headers };
}

export function buildContext(body: ResponsesRequest): Context {
  const systemPrompt = [readText(body.instructions), developerInstructionsFromResponsesInput(body.input)].filter(Boolean).join('\n\n') || undefined;
  return {
    systemPrompt,
    messages: responsesInputToPiMessages(body.input),
    tools: requestToolsToPiTools(body.tools),
  };
}

export async function createModelGatewayResponse(
  ctx: RuntimeContext,
  body: ResponsesRequest,
  settings: ModelGatewaySettings,
  options: ModelGatewayResponseOptions = {},
): Promise<ResponsesResponse> {
  const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : settings.defaultModel;
  if (requestedModel === FAKE_MODEL_GATEWAY_MODEL_ID) return fakeResponse(body, requestedModel);
  const { model, apiKey, headers } = await resolveModel(ctx, requestedModel);
  const message = await stream(model, buildContext(body), {
    apiKey,
    headers,
    signal: options.signal,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxTokens: typeof body.max_output_tokens === 'number' ? body.max_output_tokens : undefined,
  }).result();
  return {
    id: message.responseId ?? responseId(),
    object: 'response',
    created_at: nowSeconds(),
    status: message.stopReason === 'error' ? 'failed' : 'completed',
    model: `${message.provider}/${message.model}`,
    output: assistantMessageToOutput(message),
    usage: usageToResponsesUsage(message),
    ...(message.errorMessage ? { error: { message: message.errorMessage } } : {}),
  };
}

export async function* streamModelGatewayResponseEvents(
  ctx: RuntimeContext,
  body: ResponsesRequest,
  settings: ModelGatewaySettings,
  options: ModelGatewayResponseOptions = {},
): AsyncIterable<Record<string, unknown> | '[DONE]'> {
  const id = responseId();
  const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : settings.defaultModel;
  yield { type: 'response.created', response: { id, object: 'response', created_at: nowSeconds(), status: 'in_progress', model: requestedModel } };
  if (requestedModel === FAKE_MODEL_GATEWAY_MODEL_ID) {
    yield { type: 'response.output_item.added', output_index: 0, item: { id: 'msg_0', type: 'message', status: 'in_progress', role: 'assistant', content: [] } };
    yield { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'Gateway smoke OK.' };
    yield { type: 'response.output_text.done', output_index: 0, content_index: 0, text: 'Gateway smoke OK.' };
    yield { type: 'response.output_item.done', output_index: 0, item: { id: 'msg_0', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: 'Gateway smoke OK.', annotations: [] }] } };
    yield { type: 'response.completed', response: fakeResponse(body, requestedModel) };
    yield '[DONE]';
    return;
  }

  const { model, apiKey, headers } = await resolveModel(ctx, requestedModel);
  let textStarted = false;
  let currentText = '';
  let outputIndex = 0;
  const piStream = stream(model, buildContext(body), {
    apiKey,
    headers,
    signal: options.signal,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxTokens: typeof body.max_output_tokens === 'number' ? body.max_output_tokens : undefined,
  });

  for await (const event of piStream) {
    for (const responseEvent of piEventToResponsesEvents(event, { textStarted, currentText, outputIndex })) {
      if (responseEvent.kind === 'state') {
        textStarted = responseEvent.textStarted;
        currentText = responseEvent.currentText;
        outputIndex = responseEvent.outputIndex;
      } else {
        yield responseEvent.event;
      }
    }
  }
  yield '[DONE]';
}

function piEventToResponsesEvents(
  event: AssistantMessageEvent,
  state: { textStarted: boolean; currentText: string; outputIndex: number },
): Array<{ kind: 'event'; event: Record<string, unknown> } | { kind: 'state'; textStarted: boolean; currentText: string; outputIndex: number }> {
  const out: Array<{ kind: 'event'; event: Record<string, unknown> } | { kind: 'state'; textStarted: boolean; currentText: string; outputIndex: number }> = [];
  if (event.type === 'text_start' && !state.textStarted) {
    out.push({
      kind: 'event',
      event: {
        type: 'response.output_item.added',
        output_index: state.outputIndex,
        item: { id: `msg_${state.outputIndex}`, type: 'message', status: 'in_progress', role: 'assistant', content: [] },
      },
    });
    out.push({ kind: 'state', textStarted: true, currentText: state.currentText, outputIndex: state.outputIndex });
  }
  if (event.type === 'text_delta') {
    if (!state.textStarted) {
      out.push({
        kind: 'event',
        event: {
          type: 'response.output_item.added',
          output_index: state.outputIndex,
          item: { id: `msg_${state.outputIndex}`, type: 'message', status: 'in_progress', role: 'assistant', content: [] },
        },
      });
    }
    out.push({ kind: 'event', event: { type: 'response.output_text.delta', output_index: state.outputIndex, content_index: 0, delta: event.delta } });
    out.push({
      kind: 'state',
      textStarted: true,
      currentText: state.currentText + event.delta,
      outputIndex: state.outputIndex,
    });
  }
  if (event.type === 'toolcall_end') {
    out.push({
      kind: 'event',
      event: {
        type: 'response.output_item.done',
        output_index: state.outputIndex,
        item: {
          id: event.toolCall.id,
          type: 'function_call',
          status: 'completed',
          call_id: event.toolCall.id,
          name: event.toolCall.name,
          arguments: JSON.stringify(event.toolCall.arguments ?? {}),
        },
      },
    });
    out.push({ kind: 'state', textStarted: state.textStarted, currentText: state.currentText, outputIndex: state.outputIndex + 1 });
  }
  if (event.type === 'done') {
    if (state.textStarted) {
      out.push({ kind: 'event', event: { type: 'response.output_text.done', output_index: state.outputIndex, content_index: 0, text: state.currentText } });
      out.push({
        kind: 'event',
        event: {
          type: 'response.output_item.done',
          output_index: state.outputIndex,
          item: {
            id: `msg_${state.outputIndex}`,
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text: state.currentText, annotations: [] }],
          },
        },
      });
    }
    out.push({
      kind: 'event',
      event: {
        type: 'response.completed',
        response: {
          id: event.message.responseId ?? responseId(),
          object: 'response',
          created_at: nowSeconds(),
          status: 'completed',
          model: `${event.message.provider}/${event.message.model}`,
          output: assistantMessageToOutput(event.message),
          usage: usageToResponsesUsage(event.message),
        },
      },
    });
  }
  if (event.type === 'error') {
    out.push({
      kind: 'event',
      event: {
        type: 'response.failed',
        response: {
          id: event.error.responseId ?? responseId(),
          object: 'response',
          created_at: nowSeconds(),
          status: 'failed',
          model: `${event.error.provider}/${event.error.model}`,
          output: assistantMessageToOutput(event.error),
          error: { message: event.error.errorMessage ?? 'Provider request failed.' },
        },
      },
    });
  }
  return out;
}

export const smokeTool = {
  type: 'function',
  function: {
    name: 'record_gateway_smoke',
    description: 'Record that the gateway smoke tool was requested.',
    parameters: Type.Object({ message: Type.String() }),
  },
};
