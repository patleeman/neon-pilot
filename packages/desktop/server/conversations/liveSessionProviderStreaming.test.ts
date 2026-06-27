import { stream as streamOpenAICodexResponses } from '@earendil-works/pi-ai/api/openai-codex-responses';
import { afterEach, describe, expect, it, vi } from 'vitest';

type StreamEvent = { type: string; delta?: string; content?: string; message?: unknown };

function base64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function fakeCodexToken(): string {
  return [
    base64Json({ alg: 'none', typ: 'JWT' }),
    base64Json({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acct_test' } }),
    'signature',
  ].join('.');
}

function sseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  const body = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
  return new Response(new ReadableStream({ start: (controller) => controller.enqueue(encoder.encode(body)) }), { status: 200 });
}

describe('live session provider streaming', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('emits Codex text deltas when output_text arrives before content_part metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          { type: 'response.created', response: { id: 'resp_test' } },
          {
            type: 'response.output_item.added',
            item: { id: 'msg_test', type: 'message', role: 'assistant', status: 'in_progress' },
          },
          { type: 'response.output_text.delta', delta: 'Hel' },
          { type: 'response.output_text.delta', delta: 'lo' },
          {
            type: 'response.output_item.done',
            item: { id: 'msg_test', type: 'message', role: 'assistant', status: 'completed', content: [] },
          },
          {
            type: 'response.completed',
            response: {
              id: 'resp_test',
              status: 'completed',
              usage: {
                input_tokens: 1,
                output_tokens: 1,
                total_tokens: 2,
                input_tokens_details: { cached_tokens: 0 },
              },
            },
          },
        ]),
      ),
    );

    const stream = streamOpenAICodexResponses(
      {
        id: 'gpt-test',
        name: 'GPT Test',
        provider: 'openai-codex',
        api: 'openai-codex-responses',
        baseUrl: 'https://chatgpt.test/backend-api',
        input: ['text'],
        reasoning: false,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096,
      },
      { systemPrompt: '', messages: [] },
      { apiKey: fakeCodexToken(), transport: 'sse' },
    );

    const events: StreamEvent[] = [];
    for await (const event of stream) {
      events.push(event as StreamEvent);
    }

    expect(events.filter((event) => event.type === 'text_delta').map((event) => event.delta)).toEqual(['Hel', 'lo']);
    expect(events.find((event) => event.type === 'text_end')).toMatchObject({ content: 'Hello' });
    expect(events.find((event) => event.type === 'done')).toMatchObject({
      message: { content: [{ type: 'text', text: 'Hello' }] },
    });
  });
});
