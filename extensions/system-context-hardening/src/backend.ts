import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export const TOOL_RESULT_TEXT_MAX_CHARS = 64 * 1024;
const MARKER = '[Personal Agent truncated oversized tool output';

type TextContent = { type: 'text'; text: string };
type ToolResultMessage = {
  role: 'toolResult';
  content?: Array<TextContent | Record<string, unknown>> | string;
  details?: Record<string, unknown>;
  truncated?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function truncateMiddle(value: string, maxChars = TOOL_RESULT_TEXT_MAX_CHARS): { text: string; truncated: boolean; originalChars: number } {
  if (value.length <= maxChars) return { text: value, truncated: false, originalChars: value.length };

  const marker = `\n\n${MARKER}: ${value.length - maxChars} characters omitted]\n\n`;
  const budget = Math.max(0, maxChars - marker.length);
  const head = Math.ceil(budget * 0.6);
  const tail = Math.floor(budget * 0.4);
  return {
    text: `${value.slice(0, head)}${marker}${tail > 0 ? value.slice(-tail) : ''}`,
    truncated: true,
    originalChars: value.length,
  };
}

export function truncateToolResultMessage(message: ToolResultMessage): boolean {
  let truncated = false;
  let originalChars = 0;

  if (typeof message.content === 'string') {
    const result = truncateMiddle(message.content);
    if (result.truncated) {
      message.content = result.text;
      truncated = true;
      originalChars += result.originalChars;
    }
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!isRecord(part) || part.type !== 'text' || typeof part.text !== 'string') continue;
      const result = truncateMiddle(part.text);
      if (!result.truncated) continue;
      part.text = result.text;
      truncated = true;
      originalChars += result.originalChars;
    }
  }

  if (truncated) {
    message.truncated = true;
    message.details = {
      ...(isRecord(message.details) ? message.details : {}),
      contextHardening: {
        truncated: true,
        originalChars,
        maxChars: TOOL_RESULT_TEXT_MAX_CHARS,
      },
    };
  }

  return truncated;
}

function truncateResponsesPayload(value: unknown): boolean {
  let truncated = false;

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isRecord(node)) return;

    if (node.type === 'function_call_output' && typeof node.output === 'string') {
      const result = truncateMiddle(node.output);
      if (result.truncated) {
        node.output = result.text;
        truncated = true;
      }
    }

    for (const value of Object.values(node)) visit(value);
  };

  visit(value);
  return truncated;
}

export function createContextHardeningAgentExtension(): (pi: ExtensionAPI) => void {
  return (pi: ExtensionAPI) => {
    pi.on('message_end', async (event) => {
      if (!isRecord(event) || !isRecord(event.message) || event.message.role !== 'toolResult') return;
      truncateToolResultMessage(event.message as ToolResultMessage);
    });

    pi.on('before_provider_request', (event) => {
      if (!isRecord(event) || !isRecord(event.payload)) return undefined;
      if (!truncateResponsesPayload(event.payload)) return undefined;
      return event.payload;
    });
  };
}
