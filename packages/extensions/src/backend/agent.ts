import type { ExtensionBackendContext } from '../index';

export interface ExtensionAgentImageInput {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface ExtensionAgentRunTaskInput {
  cwd?: string;
  modelRef?: string;
  thinkingLevel?: string | null;
  prompt: string;
  images?: ExtensionAgentImageInput[];
  tools?: 'none' | 'default';
  allowedToolNames?: string[];
  timeoutMs?: number;
}

export interface ExtensionAgentRunTaskResult {
  text: string;
  model?: string;
  provider?: string;
}

export interface ExtensionAgentConversationCreateInput {
  title?: string;
  cwd?: string;
  modelRef?: string;
  thinkingLevel?: string | null;
  tools?: 'none' | 'default';
  allowedToolNames?: string[];
  visibility?: 'hidden' | 'visible';
  persistence?: 'ephemeral' | 'saved';
}

export interface ExtensionAgentConversationSendInput {
  conversationId: string;
  text: string;
  images?: ExtensionAgentImageInput[];
  timeoutMs?: number;
}

export type ExtensionAgentConversationStreamEvent =
  | { type: 'user_message'; text: string; id?: string; ts?: string }
  | { type: 'agent_start' }
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | { type: 'tool_end'; toolCallId: string; toolName: string; isError: boolean; durationMs: number; output: string; details?: unknown }
  | { type: 'agent_end'; text?: string }
  | { type: 'turn_end' }
  | { type: 'error'; message: string };

export interface ExtensionAgentConversationStreamResult {
  stream: 'sse';
  events: AsyncIterable<{ event?: string; data?: ExtensionAgentConversationStreamEvent }>;
}

export interface ExtensionAgentConversationSummary {
  id: string;
  ownerExtensionId: string;
  title: string;
  cwd: string;
  model?: string;
  provider?: string;
  visibility: 'hidden' | 'visible';
  persistence: 'ephemeral' | 'saved';
  tools: 'none' | 'default';
  createdAt: string;
  updatedAt: string;
  isBusy: boolean;
  disposed: boolean;
  messageCount: number;
  lastText?: string;
}

export interface ExtensionAgentConversationMessageResult extends ExtensionAgentConversationSummary {
  text: string;
}

function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/agent must be resolved by the Neon Pilot host runtime.');
}

export async function createAgentConversation(
  _input: ExtensionAgentConversationCreateInput,
  _ctx: ExtensionBackendContext,
): Promise<ExtensionAgentConversationSummary> {
  hostResolved();
}

export async function sendAgentMessage(
  _input: ExtensionAgentConversationSendInput,
  _ctx: ExtensionBackendContext,
): Promise<ExtensionAgentConversationMessageResult> {
  hostResolved();
}

export async function streamAgentMessage(
  _input: ExtensionAgentConversationSendInput,
  _ctx: ExtensionBackendContext,
): Promise<ExtensionAgentConversationStreamResult> {
  hostResolved();
}

export async function getAgentConversation(
  _input: { conversationId: string },
  _ctx: ExtensionBackendContext,
): Promise<ExtensionAgentConversationSummary> {
  hostResolved();
}

export async function listAgentConversations(_input: unknown, _ctx: ExtensionBackendContext): Promise<ExtensionAgentConversationSummary[]> {
  hostResolved();
}

export async function abortAgentConversation(
  _input: { conversationId: string },
  _ctx: ExtensionBackendContext,
): Promise<ExtensionAgentConversationSummary> {
  hostResolved();
}

export async function disposeAgentConversation(
  _input: { conversationId: string },
  _ctx: ExtensionBackendContext,
): Promise<{ ok: true; conversationId: string }> {
  hostResolved();
}

export async function runAgentTask(
  _input: ExtensionAgentRunTaskInput,
  _ctx: ExtensionBackendContext,
): Promise<ExtensionAgentRunTaskResult> {
  hostResolved();
}
