import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { stream, type Api, type AssistantMessage, type AssistantMessageEvent, type Context, type Message, type Model, Type } from '@earendil-works/pi-ai';

import { readSavedModelRef } from './models/modelPreferences.js';

export const DEFAULT_MODEL_GATEWAY_PORT = 8766;
export const FAKE_MODEL_GATEWAY_MODEL_ID = 'neon-pilot-fake';
export const DEFAULT_MODEL_GATEWAY_MODEL_ID = 'auto';

export interface ModelGatewaySettings {
  port: number;
  host: string;
  defaultModel: string;
}

export interface ModelGatewayModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ModelGatewayStatus {
  running: boolean;
  host: string;
  port: number;
  baseUrl: string;
  models: number;
  defaultModel: string;
  lastError?: string;
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
    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
    if (record.content !== undefined) return readText(record.content);
  }
  return '';
}

function normalizeToolParameters(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return { type: 'object', properties: {} };
}

function requestToolsToPiTools(tools: unknown): Context['tools'] {
  if (!Array.isArray(tools)) return undefined;
  const converted = tools
    .map((tool) => {
      if (!tool || typeof tool !== 'object') return null;
      const record = tool as Record<string, unknown>;
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
  if (!Array.isArray(input)) return [{ role: 'user', content: readText(input), timestamp: Date.now() }];

  const messages: Message[] = [];
  const pendingToolCalls = new Map<string, { message: Message; bufferedMessages: Message[]; name: string }>();
  const flushPendingToolCalls = (): void => {
    for (const [callId, pending] of pendingToolCalls) {
      messages.push(...pending.bufferedMessages, pending.message);
      pendingToolCalls.delete(callId);
    }
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
      pendingToolCalls.set(callId, {
        name,
        bufferedMessages: [],
        message: {
          role: 'assistant',
          content: [{ type: 'toolCall', id: callId, name, arguments: parseFunctionCallArguments(record.arguments) }],
          api: 'openai-responses',
          provider: 'neon-pilot',
          model: 'replayed',
          usage: zeroUsage(),
          stopReason: 'tool_use',
          timestamp: Date.now(),
        },
      });
      continue;
    }
    if (type === 'function_call_output') {
      const callId = String(record.call_id ?? '');
      const pending = pendingToolCalls.get(callId);
      if (pending) {
        messages.push(...pending.bufferedMessages, pending.message);
        pendingToolCalls.delete(callId);
      } else {
        flushPendingToolCalls();
      }
      messages.push({
        role: 'toolResult',
        toolCallId: callId,
        toolName: pending?.name ?? '',
        content: [{ type: 'text', text: readText(record.output) }],
        isError: false,
        timestamp: Date.now(),
      });
      continue;
    }
    if (type === 'message' || record.role) {
      const role = record.role === 'assistant' ? 'assistant' : 'user';
      const text = readText(record.content);
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
        const pendingCalls = [...pendingToolCalls.values()];
        if (pendingCalls.length > 0) {
          pendingCalls[pendingCalls.length - 1]!.bufferedMessages.push(assistantMessage);
        } else {
          messages.push(assistantMessage);
        }
      } else {
        messages.push({ role: 'user', content: text, timestamp: Date.now() });
      }
    }
  }
  flushPendingToolCalls();
  return messages.length ? messages : [{ role: 'user', content: '', timestamp: Date.now() }];
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
  return { port, host, defaultModel };
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
    return [
      { id, object: 'model' as const, created, owned_by: model.provider },
      ...(models.filter((candidate) => candidate.id === model.id).length === 1
        ? [{ id: model.id, object: 'model' as const, created, owned_by: model.provider }]
        : []),
    ];
  });
  entries.unshift({ id: FAKE_MODEL_GATEWAY_MODEL_ID, object: 'model' as const, created, owned_by: 'neon-pilot' });
  if (models.length) entries.unshift({ id: DEFAULT_MODEL_GATEWAY_MODEL_ID, object: 'model' as const, created, owned_by: 'neon-pilot' });
  return entries;
}

function resolveDefaultModelRef(ctx: RuntimeContext, models: Array<Model<Api>>): string {
  return readSavedModelRef(
    `${ctx.runtimeDir}/settings.json`,
    models.map((model) => ({ id: model.id, provider: model.provider })),
  );
}

function fakeResponse(body: ResponsesRequest, model: string): ResponsesResponse {
  const text = readText(body.input) || 'Hello from Neon Pilot Model Gateway.';
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

function buildContext(body: ResponsesRequest): Context {
  return {
    systemPrompt: readText(body.instructions) || undefined,
    messages: responsesInputToPiMessages(body.input),
    tools: requestToolsToPiTools(body.tools),
  };
}

export async function createModelGatewayResponse(ctx: RuntimeContext, body: ResponsesRequest, settings: ModelGatewaySettings): Promise<ResponsesResponse> {
  const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : settings.defaultModel;
  if (requestedModel === FAKE_MODEL_GATEWAY_MODEL_ID) return fakeResponse(body, requestedModel);
  const { model, apiKey, headers } = await resolveModel(ctx, requestedModel);
  const message = await stream(model, buildContext(body), {
    apiKey,
    headers,
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
