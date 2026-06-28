import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { SseEvent } from '../conversations/liveSessionEvents.js';
import { invalidateAppTopics } from '../shared/appEvents.js';
import {
  attachGatewayConversation,
  findGatewayChatTarget,
  findGatewayChatTargetByConversation,
  recordGatewayEvent,
  updateGatewayConnectionStatus,
  upsertGatewayChatTarget,
} from './gatewayState.js';
import { hasTelegramAccessApprovals, isTelegramMessageApproved, type TelegramAccessPolicy } from './telegramAccess.js';
import { formatTelegramGatewayHelp, parseTelegramGatewayCommand } from './telegramCommands.js';

interface TelegramChat {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  title?: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
  file_size?: number;
}

interface TelegramVoice {
  file_id: string;
  file_unique_id?: string;
  duration?: number;
  mime_type?: string;
  file_size?: number;
}

interface TelegramUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  voice?: TelegramVoice;
}

interface TelegramCallbackQuery {
  id: string;
  from?: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramInlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface TelegramSendMessageOptions {
  reply_markup?: { inline_keyboard: TelegramInlineKeyboardButton[][] };
  parse_mode?: 'HTML';
  disable_web_page_preview?: boolean;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramSentMessage {
  message_id: number;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export interface TelegramGatewayConversationSummary {
  id: string;
  title?: string;
  updatedAt?: string;
}

interface TelegramGatewayModelSummary {
  id: string;
  label?: string;
  provider?: string;
}

export interface TelegramGatewayRuntimeDependencies {
  stateRoot: string;
  profile: string;
  authFile: string;
  createConversation: (input: { title: string }) => Promise<{ id: string }>;
  listConversations: () => Promise<TelegramGatewayConversationSummary[]> | TelegramGatewayConversationSummary[];
  listModels: () => Promise<TelegramGatewayModelSummary[]> | TelegramGatewayModelSummary[];
  submitPrompt: (input: {
    conversationId: string;
    text: string;
    images?: Array<{ data: string; mimeType: string; name?: string }>;
  }) => Promise<void>;
  readLatestAssistantReply?: (conversationId: string) => Promise<{ text: string; timestamp?: string } | null>;
  subscribeConversationEvents?: (conversationId: string, listener: (event: SseEvent) => void) => (() => void) | null;
  transcribeAudio?: (input: { dataBase64: string; mimeType?: string; fileName?: string; language?: string }) => Promise<{ text: string }>;
  renameConversation: (conversationId: string, title: string) => Promise<void> | void;
  compactConversation: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  getCurrentModel: (conversationId: string) => Promise<string | null> | string | null;
  setModel: (conversationId: string, model: string) => Promise<void>;
  readBotToken: () => string | null;
  readAccessPolicy: () => TelegramAccessPolicy;
  notifyNewConversation?: (conversationId: string) => void;
  fetch?: typeof fetch;
}

const TYPING_INTERVAL_MS = 4_000;
const TELEGRAM_MESSAGE_LIMIT = 4_096;
const TELEGRAM_TOOL_STATUS_LIMIT = 180;
const RECENT_REPLY_DEDUPE_MS = 30_000;
const TELEGRAM_GATEWAY_LOCK_FILE = 'telegram-gateway.poller.lock';

export interface TelegramToolStatus {
  toolName: string;
  summary: string;
  status: 'running' | 'done' | 'error';
}

class TypingIndicator {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly send: () => Promise<void>) {}

  start(): void {
    if (this.timer) return;
    void this.send().catch(() => undefined);
    this.timer = setInterval(() => void this.send().catch(() => undefined), TYPING_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export class TelegramGatewayRuntime {
  private abortController: AbortController | null = null;
  private polling = false;
  private lockPath: string | null = null;
  private readonly runtimeId = `${process.pid}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  private nextOffset = 0;
  private typingIndicators = new Map<string, TypingIndicator>();
  private pendingStatusMessages = new Map<string, { chatId: string; messageId: number }>();
  private streamSubscriptions = new Map<string, () => void>();
  private streamingAssistantText = new Map<string, string>();
  private toolStatuses = new Map<string, Map<string, TelegramToolStatus>>();
  private deliveredToolStatusKeys = new Map<string, Set<string>>();
  private lastPollingFailureMessage: string | null = null;
  private recentDeliveredReplies = new Map<string, { text: string; deliveredAtMs: number }>();

  constructor(private readonly dependencies: TelegramGatewayRuntimeDependencies) {}

  start(): void {
    if (this.polling) return;
    const token = this.dependencies.readBotToken();
    if (!token) return;
    if (!this.acquirePollerLock()) return;
    const abortController = new AbortController();
    this.abortController = abortController;
    this.polling = true;
    void this.configureBotCommands(token).catch(() => undefined);
    void this.pollLoop(token, abortController.signal).finally(() => {
      if (this.abortController === abortController) {
        this.polling = false;
        this.abortController = null;
        this.releasePollerLock();
      }
    });
  }

  stop(): void {
    this.polling = false;
    this.abortController?.abort();
    this.abortController = null;
    this.lastPollingFailureMessage = null;
    this.releasePollerLock();
    for (const indicator of this.typingIndicators.values()) indicator.stop();
    this.typingIndicators.clear();
    for (const unsubscribe of this.streamSubscriptions.values()) unsubscribe();
    this.streamSubscriptions.clear();
    this.streamingAssistantText.clear();
    this.toolStatuses.clear();
    this.deliveredToolStatusKeys.clear();
  }

  isRunning(): boolean {
    return this.polling && this.abortController?.signal.aborted !== true;
  }

  hasRecentlyDeliveredAssistantReply(input: { conversationId: string; text: string }): boolean {
    const recent = this.recentDeliveredReplies.get(input.conversationId);
    if (!recent || recent.text !== input.text.trim()) return false;
    return Date.now() - recent.deliveredAtMs <= RECENT_REPLY_DEDUPE_MS;
  }

  async processUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.processCallbackQuery(update.callback_query);
      return;
    }

    const message = update.message;
    if (!message) return;

    const externalChatId = String(message.chat.id);
    const externalUserId = message.from ? String(message.from.id) : undefined;
    const externalChatLabel = formatTelegramChatLabel(message.chat);
    const text = (message.text ?? message.caption ?? '').trim();
    if (!this.isMessageApproved({ externalChatId, externalUserId, externalChatLabel })) {
      await this.sendMessage(
        externalChatId,
        `This Telegram chat is not approved for Neon Pilot. Ask the app owner to approve chat ID ${externalChatId}${
          externalUserId ? ` or user ID ${externalUserId}` : ''
        }.`,
      );
      return;
    }
    const command = parseTelegramGatewayCommand(text);
    const target = await this.ensureChatTarget({ externalChatId, externalChatLabel, forceNew: command?.kind === 'new' });

    if (command) {
      await this.handleCommand(command, {
        conversationId: target.conversationId,
        conversationTitle: target.conversationTitle,
        externalChatId,
        externalChatLabel,
        externalUserId,
      });
      return;
    }

    if (!text && !message.photo?.length && !message.voice) {
      await this.sendMessage(externalChatId, 'Unsupported Telegram message type. Send text, a photo, or a voice message.');
      return;
    }

    const images = message.photo?.length ? await this.loadTelegramPhotos(message.photo) : undefined;
    if (this.pendingStatusMessages.has(target.conversationId)) {
      try {
        const voiceTranscript = message.voice ? await this.transcribeTelegramVoice(message.voice) : undefined;
        if (voiceTranscript?.text) {
          await this.sendMessage(externalChatId, `🎙️ "${voiceTranscript.text}"`);
        }
        await this.sendMessage(externalChatId, 'Queued behind the current Telegram request.');
        await this.dependencies.submitPrompt({
          conversationId: target.conversationId,
          text: buildTelegramPromptText({ text, hasPhoto: Boolean(images?.length), voiceTranscript: voiceTranscript?.text }),
          images,
        });
        return;
      } catch (error) {
        const failure = error instanceof Error ? error.message : String(error);
        await this.sendMessage(externalChatId, `Telegram prompt failed: ${failure}`);
        throw error;
      }
    }

    this.startTyping(externalChatId);
    const statusMessage = await this.sendMessage(externalChatId, '⏳ Working…');
    if (statusMessage?.message_id) {
      this.pendingStatusMessages.set(target.conversationId, { chatId: externalChatId, messageId: statusMessage.message_id });
    }
    this.startConversationEventStream(target.conversationId);
    try {
      const voiceTranscript = message.voice ? await this.transcribeTelegramVoice(message.voice) : undefined;
      if (voiceTranscript?.text) {
        await this.sendMessage(externalChatId, `🎙️ "${voiceTranscript.text}"`);
      }
      const promptStartedAtMs = Date.now();
      await this.dependencies.submitPrompt({
        conversationId: target.conversationId,
        text: buildTelegramPromptText({ text, hasPhoto: Boolean(images?.length), voiceTranscript: voiceTranscript?.text }),
        images,
      });
      await this.deliverLatestAssistantReplyWhenAvailable(target.conversationId, promptStartedAtMs);
      this.startConversationEventStream(target.conversationId);
    } catch (error) {
      this.stopTyping(externalChatId);
      this.pendingStatusMessages.delete(target.conversationId);
      this.stopConversationEventStream(target.conversationId);
      const failure = error instanceof Error ? error.message : String(error);
      if (statusMessage?.message_id) {
        await this.editMessage(externalChatId, statusMessage.message_id, `Telegram prompt failed: ${failure}`);
      } else {
        await this.sendMessage(externalChatId, `Telegram prompt failed: ${failure}`);
      }
      throw error;
    }
  }

  private async deliverLatestAssistantReplyWhenAvailable(conversationId: string, promptStartedAtMs: number): Promise<void> {
    const readLatestAssistantReply = this.dependencies.readLatestAssistantReply;
    if (!readLatestAssistantReply) return;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const reply = await readLatestAssistantReply(conversationId);
      const replyTimeMs = reply?.timestamp ? Date.parse(reply.timestamp) : Number.NaN;
      const isFreshReply = reply && (!Number.isFinite(replyTimeMs) || replyTimeMs >= promptStartedAtMs);
      if (isFreshReply && !this.hasRecentlyDeliveredAssistantReply({ conversationId, text: reply.text })) {
        const delivered = await this.deliverAssistantReply({ conversationId, text: reply.text });
        if (delivered) return;
      }
      if (!this.pendingStatusMessages.has(conversationId)) return;
      await sleep(500);
    }
  }

  async deliverAssistantReply(input: { conversationId: string; text: string }): Promise<boolean> {
    const text = input.text.trim();
    if (!text) return false;
    if (isTelegramSilenceToken(text)) return true;

    const target = findGatewayChatTargetByConversation({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      conversationId: input.conversationId,
    });
    if (!target) return false;

    this.stopTyping(target.externalChatId);
    this.stopConversationEventStream(input.conversationId);
    const pending = this.pendingStatusMessages.get(input.conversationId);
    if (pending) {
      this.pendingStatusMessages.delete(input.conversationId);
      const edited = await this.tryEditMessage(pending.chatId, pending.messageId, text);
      if (!edited) {
        await this.sendMessage(target.externalChatId, text);
      }
    } else {
      await this.sendMessage(target.externalChatId, text);
    }
    recordGatewayEvent({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      conversationId: input.conversationId,
      kind: 'outbound',
      message: `Delivered assistant reply to ${target.externalChatLabel || target.externalChatId}`,
    });
    this.recentDeliveredReplies.set(input.conversationId, { text, deliveredAtMs: Date.now() });
    return true;
  }

  private startConversationEventStream(conversationId: string): void {
    if (this.streamSubscriptions.has(conversationId)) return;
    const unsubscribe = this.dependencies.subscribeConversationEvents?.(conversationId, (event) => {
      void this.handleConversationStreamEvent(conversationId, event).catch(() => undefined);
    });
    if (!unsubscribe) return;
    this.streamSubscriptions.set(conversationId, unsubscribe);
  }

  private stopConversationEventStream(conversationId: string): void {
    this.streamSubscriptions.get(conversationId)?.();
    this.streamSubscriptions.delete(conversationId);
    this.streamingAssistantText.delete(conversationId);
    this.toolStatuses.delete(conversationId);
    this.deliveredToolStatusKeys.delete(conversationId);
  }

  private async handleConversationStreamEvent(conversationId: string, event: SseEvent): Promise<void> {
    if (event.type === 'text_delta') {
      if (event.delta) {
        this.streamingAssistantText.set(conversationId, `${this.streamingAssistantText.get(conversationId) ?? ''}${event.delta}`);
      }
      return;
    }

    if (event.type === 'tool_start') {
      const statuses = this.toolStatuses.get(conversationId) ?? new Map<string, TelegramToolStatus>();
      statuses.set(event.toolCallId, {
        toolName: event.toolName,
        summary: formatTelegramToolSummary(event.toolName, event.args),
        status: 'running',
      });
      this.toolStatuses.set(conversationId, statuses);
      await this.sendToolStatus(conversationId, event.toolCallId, 'start');
      return;
    }

    if (event.type === 'tool_end') {
      const statuses = this.toolStatuses.get(conversationId) ?? new Map<string, TelegramToolStatus>();
      const existing = statuses.get(event.toolCallId);
      statuses.set(event.toolCallId, {
        toolName: event.toolName,
        summary: existing?.summary || formatTelegramToolSummary(event.toolName, undefined),
        status: event.isError ? 'error' : 'done',
      });
      this.toolStatuses.set(conversationId, statuses);
      await this.sendToolStatus(conversationId, event.toolCallId, 'end');
      return;
    }

    if (event.type === 'agent_end') {
      const text = this.streamingAssistantText.get(conversationId)?.trim();
      if (text) {
        await this.deliverAssistantReply({ conversationId, text });
        return;
      }
      this.stopConversationEventStream(conversationId);
      return;
    }

    if (event.type === 'turn_end') {
      this.stopConversationEventStream(conversationId);
    }
  }

  private async sendToolStatus(conversationId: string, toolCallId: string, phase: 'start' | 'end'): Promise<void> {
    const pending = this.pendingStatusMessages.get(conversationId);
    if (!pending) return;
    const status = this.toolStatuses.get(conversationId)?.get(toolCallId);
    if (!status) return;
    const statusKey = `${toolCallId}:${phase}:${status.status}`;
    const delivered = this.deliveredToolStatusKeys.get(conversationId) ?? new Set<string>();
    if (delivered.has(statusKey)) return;
    delivered.add(statusKey);
    this.deliveredToolStatusKeys.set(conversationId, delivered);
    await this.sendMessage(pending.chatId, renderTelegramToolStatus(status));
  }

  private isMessageApproved(input: { externalChatId: string; externalUserId?: string; externalChatLabel: string }): boolean {
    const policy = this.dependencies.readAccessPolicy();
    if (isTelegramMessageApproved(policy, { chatId: input.externalChatId, userId: input.externalUserId })) {
      return true;
    }
    const message = hasTelegramAccessApprovals(policy)
      ? `Rejected Telegram message from unapproved chat ${input.externalChatLabel || input.externalChatId}`
      : 'Rejected Telegram message because no approved Telegram users or chats are configured';
    recordGatewayEvent({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      kind: 'error',
      message,
    });
    return false;
  }

  private async processCallbackQuery(callback: TelegramCallbackQuery): Promise<void> {
    if (!callback.message?.chat || !callback.data) return;
    await this.answerCallbackQuery(callback.id).catch(() => undefined);
    const data = callback.data.trim();
    if (data.startsWith('threadpage:')) {
      const page = Number.parseInt(data.slice(11), 10);
      await this.sendMessage(String(callback.message.chat.id), await this.formatConversationList('Recent Neon Pilot conversations:'), {
        reply_markup: await this.conversationKeyboard(Number.isFinite(page) ? page : 0),
      });
      return;
    }
    if (data.startsWith('modelpage:')) {
      const page = Number.parseInt(data.slice(10), 10);
      const chatId = String(callback.message.chat.id);
      const target = findGatewayChatTarget({
        stateRoot: this.dependencies.stateRoot,
        profile: this.dependencies.profile,
        provider: 'telegram',
        externalChatId: chatId,
      });
      const currentModel = target?.conversationId ? await this.dependencies.getCurrentModel(target.conversationId) : undefined;
      await this.sendMessage(chatId, currentModel ? `Current model: ${currentModel}` : 'Choose a model:', {
        reply_markup: await this.modelKeyboard(
          typeof currentModel === 'string' ? currentModel : undefined,
          Number.isFinite(page) ? page : 0,
        ),
      });
      return;
    }
    const text = data.startsWith('cmd:')
      ? data.slice(4)
      : data.startsWith('switch:')
        ? `/switch ${data.slice(7)}`
        : data.startsWith('model:')
          ? `/model ${data.slice(6)}`
          : '';
    if (!text) return;
    await this.processUpdate({
      update_id: 0,
      message: { ...callback.message, from: callback.from, text },
    });
  }

  private async ensureChatTarget(input: {
    externalChatId: string;
    externalChatLabel: string;
    forceNew?: boolean;
  }): Promise<{ conversationId: string; conversationTitle: string }> {
    const existing = input.forceNew
      ? null
      : findGatewayChatTarget({
          stateRoot: this.dependencies.stateRoot,
          profile: this.dependencies.profile,
          provider: 'telegram',
          externalChatId: input.externalChatId,
        });
    if (existing && existing.conversationId) {
      return { conversationId: existing.conversationId, conversationTitle: existing.conversationTitle || existing.conversationId };
    }

    const title = `Telegram: ${input.externalChatLabel || input.externalChatId}`;
    const created = await this.dependencies.createConversation({ title });
    void this.dependencies.notifyNewConversation?.(created.id);
    upsertGatewayChatTarget({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      externalChatId: input.externalChatId,
      externalChatLabel: input.externalChatLabel,
      conversationId: created.id,
      conversationTitle: title,
    });

    attachGatewayConversation({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      conversationId: created.id,
      conversationTitle: title,
      externalChatId: input.externalChatId,
      externalChatLabel: input.externalChatLabel,
    });

    await this.dependencies.renameConversation(created.id, title);
    return { conversationId: created.id, conversationTitle: title };
  }

  private async handleCommand(
    command: NonNullable<ReturnType<typeof parseTelegramGatewayCommand>>,
    target: {
      conversationId: string;
      conversationTitle?: string;
      externalChatId: string;
      externalChatLabel: string;
      externalUserId?: string;
    },
  ): Promise<void> {
    switch (command.kind) {
      case 'start':
        await this.sendMessage(target.externalChatId, `Connected to ${target.externalChatLabel}. Use /help for commands.`, {
          reply_markup: commandKeyboard(),
        });
        return;
      case 'help':
        await this.sendMessage(target.externalChatId, formatTelegramGatewayHelp(), { reply_markup: commandKeyboard() });
        return;
      case 'status': {
        const model = await this.dependencies.getCurrentModel(target.conversationId);
        await this.sendMessage(
          target.externalChatId,
          `Telegram gateway active. Conversation: ${target.conversationId}${model ? `\nModel: ${model}` : ''}`,
          { reply_markup: statusKeyboard() },
        );
        return;
      }
      case 'whoami': {
        const policy = this.dependencies.readAccessPolicy();
        const approvedByChat = policy.approvedChatIds.includes(target.externalChatId);
        const approvedByUser = Boolean(target.externalUserId && policy.approvedUserIds.includes(target.externalUserId));
        await this.sendMessage(
          target.externalChatId,
          [
            'Telegram access:',
            `Chat ID: ${target.externalChatId}`,
            target.externalUserId ? `User ID: ${target.externalUserId}` : 'User ID: unavailable',
            `Approved: ${approvedByChat || approvedByUser ? 'yes' : 'no'}`,
            approvedByChat ? 'Matched: chat ID' : approvedByUser ? 'Matched: user ID' : 'Matched: none',
          ].join('\n'),
        );
        return;
      }
      case 'threads':
        await this.sendMessage(target.externalChatId, await this.formatConversationList(), {
          reply_markup: await this.conversationKeyboard(),
        });
        return;
      case 'switch':
        if (!command.target) {
          await this.sendMessage(
            target.externalChatId,
            await this.formatConversationList('Send /switch <number>, /switch <title>, or /switch <id>.'),
            { reply_markup: await this.conversationKeyboard() },
          );
          return;
        }
        await this.switchConversation(command.target, target);
        return;
      case 'stop':
      case 'detach':
        upsertGatewayChatTarget({
          stateRoot: this.dependencies.stateRoot,
          profile: this.dependencies.profile,
          provider: 'telegram',
          externalChatId: target.externalChatId,
          externalChatLabel: target.externalChatLabel,
          conversationId: target.conversationId,
          repliesEnabled: false,
        });
        await this.sendMessage(target.externalChatId, 'Telegram replies paused for this conversation. Use /resume to re-enable.');
        return;
      case 'resume':
      case 'attach':
        upsertGatewayChatTarget({
          stateRoot: this.dependencies.stateRoot,
          profile: this.dependencies.profile,
          provider: 'telegram',
          externalChatId: target.externalChatId,
          externalChatLabel: target.externalChatLabel,
          conversationId: target.conversationId,
          repliesEnabled: true,
        });
        attachGatewayConversation({
          stateRoot: this.dependencies.stateRoot,
          profile: this.dependencies.profile,
          provider: 'telegram',
          conversationId: target.conversationId,
          externalChatId: target.externalChatId,
          externalChatLabel: target.externalChatLabel,
        });
        await this.sendMessage(target.externalChatId, 'Telegram replies enabled and this chat is attached.');
        return;
      case 'new':
        await this.sendMessage(target.externalChatId, 'Started a new Telegram conversation.');
        return;
      case 'model':
        if (!command.model) {
          const model = await this.dependencies.getCurrentModel(target.conversationId);
          await this.sendMessage(target.externalChatId, model ? `Current model: ${model}` : 'No model selected.', {
            reply_markup: await this.modelKeyboard(model ?? undefined, 0),
          });
          return;
        }
        await this.dependencies.setModel(target.conversationId, command.model);
        await this.sendMessage(target.externalChatId, `Model set to ${command.model}.`);
        return;
      case 'compact':
        await this.dependencies.compactConversation(target.conversationId);
        await this.sendMessage(target.externalChatId, 'Compaction requested.');
        return;
      case 'title':
        await this.sendMessage(target.externalChatId, `Current thread title: ${target.conversationTitle || target.conversationId}`);
        return;
      case 'rename':
        await this.dependencies.renameConversation(target.conversationId, command.title);
        await this.sendMessage(target.externalChatId, `Renamed thread to ${command.title}.`);
        return;
      case 'archive':
        await this.dependencies.archiveConversation(target.conversationId);
        await this.sendMessage(target.externalChatId, 'Archived and detached this thread.');
        return;
    }
  }

  private async formatConversationList(prefix = 'Recent Neon Pilot conversations:'): Promise<string> {
    const conversations = (await this.dependencies.listConversations()).slice(0, 12);
    if (conversations.length === 0) return 'No Neon Pilot conversations found. Send /new to start one.';
    return [
      prefix,
      ...conversations.map((conversation, index) => `${index + 1}. ${conversation.title || conversation.id} — ${conversation.id}`),
    ].join('\n');
  }

  private async conversationKeyboard(page = 0): Promise<{ inline_keyboard: TelegramInlineKeyboardButton[][] }> {
    const pageSize = 8;
    const conversations = await this.dependencies.listConversations();
    const pageCount = Math.max(1, Math.ceil(conversations.length / pageSize));
    const safePage = Math.min(Math.max(0, page), pageCount - 1);
    const visibleConversations = conversations.slice(safePage * pageSize, safePage * pageSize + pageSize);
    const rows = visibleConversations.map((conversation, index) => [
      {
        text: `${safePage * pageSize + index + 1}. ${truncateButtonText(conversation.title || conversation.id)}`,
        callback_data: `switch:${conversation.id}`,
      },
    ]);
    if (pageCount > 1) {
      rows.push([
        { text: '‹ Prev', callback_data: `threadpage:${Math.max(0, safePage - 1)}` },
        { text: `${safePage + 1}/${pageCount}`, callback_data: `threadpage:${safePage}` },
        { text: 'Next ›', callback_data: `threadpage:${Math.min(pageCount - 1, safePage + 1)}` },
      ]);
    }
    rows.push([
      { text: 'New thread', callback_data: 'cmd:/new' },
      { text: 'Refresh list', callback_data: `threadpage:${safePage}` },
    ]);
    return { inline_keyboard: rows };
  }

  private async modelKeyboard(currentModel?: string, page = 0): Promise<{ inline_keyboard: TelegramInlineKeyboardButton[][] }> {
    const pageSize = 8;
    const models = await this.dependencies.listModels();
    const pageCount = Math.max(1, Math.ceil(models.length / pageSize));
    const safePage = Math.min(Math.max(0, page), pageCount - 1);
    const visibleModels = models.slice(safePage * pageSize, safePage * pageSize + pageSize);
    const rows = visibleModels.map((model) => [
      {
        text: `${model.id === currentModel ? '✓ ' : ''}${truncateButtonText(model.label || model.id)}`,
        callback_data: `model:${model.id}`,
      },
    ]);
    if (pageCount > 1) {
      rows.push([
        { text: '‹ Prev', callback_data: `modelpage:${Math.max(0, safePage - 1)}` },
        { text: `${safePage + 1}/${pageCount}`, callback_data: `modelpage:${safePage}` },
        { text: 'Next ›', callback_data: `modelpage:${Math.min(pageCount - 1, safePage + 1)}` },
      ]);
    }
    rows.push([
      { text: 'Refresh models', callback_data: `modelpage:${safePage}` },
      { text: 'Cancel', callback_data: 'cmd:/status' },
    ]);
    return { inline_keyboard: rows };
  }

  private async switchConversation(
    target: string,
    chat: { conversationId: string; externalChatId: string; externalChatLabel: string },
  ): Promise<void> {
    const conversations = await this.dependencies.listConversations();
    const normalizedTarget = target.trim().toLowerCase();
    const byNumber = /^\d+$/.test(normalizedTarget) ? conversations[Number.parseInt(normalizedTarget, 10) - 1] : undefined;
    const matches = conversations.filter(
      (conversation) =>
        conversation.id.toLowerCase() === normalizedTarget || (conversation.title || '').toLowerCase().includes(normalizedTarget),
    );
    const selected = byNumber ?? (matches.length === 1 ? matches[0] : undefined);
    if (!selected) {
      await this.sendMessage(
        chat.externalChatId,
        matches.length > 1
          ? `Multiple conversations matched "${target}".\n${await this.formatConversationList('Pick one with /switch <number>:')}`
          : `No conversation matched "${target}".\n${await this.formatConversationList('Pick one with /switch <number>:')}`,
        { reply_markup: await this.conversationKeyboard() },
      );
      return;
    }

    attachGatewayConversation({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      conversationId: selected.id,
      conversationTitle: selected.title,
      externalChatId: chat.externalChatId,
      externalChatLabel: chat.externalChatLabel,
    });
    await this.sendMessage(chat.externalChatId, `Switched this Telegram chat to ${selected.title || selected.id}.`);
  }

  private async configureBotCommands(token: string): Promise<void> {
    await this.telegramRequest(token, 'setMyCommands', {
      commands: [
        { command: 'help', description: 'Show Telegram gateway commands' },
        { command: 'commands', description: 'Show Telegram gateway commands' },
        { command: 'new', description: 'Start a new Neon Pilot conversation' },
        { command: 'reset', description: 'Reset this chat to a new conversation' },
        { command: 'threads', description: 'List and switch conversations' },
        { command: 'sessions', description: 'List and switch conversations' },
        { command: 'model', description: 'Show or change the model' },
        { command: 'status', description: 'Show current gateway status' },
        { command: 'whoami', description: 'Show your Telegram IDs and access status' },
        { command: 'stop', description: 'Pause replies for this conversation' },
        { command: 'pause', description: 'Pause replies for this conversation' },
        { command: 'resume', description: 'Resume replies or switch to a named thread' },
        { command: 'compact', description: 'Compact the current thread' },
        { command: 'title', description: 'Show or rename the current thread' },
        { command: 'rename', description: 'Rename the current thread' },
        { command: 'archive', description: 'Archive and detach the thread' },
      ],
    });
  }

  private acquirePollerLock(): boolean {
    const lockPath = join(this.dependencies.stateRoot, TELEGRAM_GATEWAY_LOCK_FILE);
    mkdirSync(dirname(lockPath), { recursive: true });
    const payload = JSON.stringify({
      pid: process.pid,
      runtimeId: this.runtimeId,
      profile: this.dependencies.profile,
      startedAt: new Date().toISOString(),
    });
    try {
      writeFileSync(lockPath, payload, { flag: 'wx' });
      this.lockPath = lockPath;
      return true;
    } catch {
      const existing = this.readPollerLock(lockPath);
      if (existing?.pid && this.isProcessAlive(existing.pid)) {
        if (existing.pid !== process.pid) {
          void recordGatewayEvent({
            stateRoot: this.dependencies.stateRoot,
            profile: this.dependencies.profile,
            provider: 'telegram',
            kind: 'error',
            message: `Telegram gateway is already polling in process ${existing.pid}.`,
          });
        }
        return false;
      }
      rmSync(lockPath, { force: true });
      writeFileSync(lockPath, payload, { flag: 'wx' });
      this.lockPath = lockPath;
      return true;
    }
  }

  private readPollerLock(lockPath: string): { pid?: number } | null {
    try {
      const parsed = JSON.parse(readFileSync(lockPath, 'utf8')) as { pid?: unknown };
      return typeof parsed.pid === 'number' ? { pid: parsed.pid } : null;
    } catch {
      return null;
    }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private releasePollerLock(): void {
    if (!this.lockPath) return;
    const existing = this.readPollerLock(this.lockPath);
    if (existing?.pid === process.pid) {
      rmSync(this.lockPath, { force: true });
    }
    this.lockPath = null;
  }

  private async pollLoop(token: string, signal: AbortSignal): Promise<void> {
    while (this.polling && !signal.aborted) {
      try {
        const updates = await this.telegramRequest<TelegramUpdate[]>(
          token,
          'getUpdates',
          {
            timeout: 50,
            offset: this.nextOffset || undefined,
            allowed_updates: ['message', 'callback_query'],
          },
          signal,
        );
        this.markPollingHealthy();
        for (const update of updates) {
          try {
            await this.processUpdate(update);
            this.nextOffset = Math.max(this.nextOffset, update.update_id + 1);
          } catch (error) {
            this.recordUpdateFailure(update, error);
            await sleep(10_000);
            break;
          }
        }
      } catch (error) {
        if (signal.aborted) return;
        this.markPollingFailed(error);
        await sleep(10_000);
      }
    }
  }

  private markPollingHealthy(): void {
    if (this.lastPollingFailureMessage === null) return;
    this.lastPollingFailureMessage = null;
    updateGatewayConnectionStatus({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      status: 'active',
      enabled: true,
      statusMessage: 'Telegram gateway connected',
    });
    invalidateAppTopics('gateways', 'sessions');
  }

  private markPollingFailed(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (this.lastPollingFailureMessage === message) return;
    this.lastPollingFailureMessage = message;
    updateGatewayConnectionStatus({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      status: 'needs_attention',
      enabled: true,
      statusMessage: `Telegram polling failed: ${message}`,
    });
    invalidateAppTopics('gateways', 'sessions');
  }

  private recordUpdateFailure(update: TelegramUpdate, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    recordGatewayEvent({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      kind: 'error',
      message: `Telegram update ${update.update_id} failed: ${message}`,
    });
    invalidateAppTopics('gateways', 'sessions');
  }

  private async loadTelegramPhotos(
    photos: TelegramPhotoSize[],
  ): Promise<Array<{ data: string; mimeType: string; name?: string }> | undefined> {
    const best = [...photos].sort((left, right) => (right.file_size ?? 0) - (left.file_size ?? 0))[0];
    const token = this.dependencies.readBotToken();
    if (!best || !token) return undefined;
    const file = await this.telegramRequest<{ file_path?: string }>(token, 'getFile', { file_id: best.file_id });
    if (!file.file_path) return undefined;
    const fetchImpl = this.dependencies.fetch ?? fetch;
    const response = await fetchImpl(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return [{ data: bytesToBase64(bytes), mimeType: response.headers.get('content-type') || 'image/jpeg', name: 'telegram-photo.jpg' }];
  }

  private async transcribeTelegramVoice(voice: TelegramVoice): Promise<{ text: string } | undefined> {
    if (!this.dependencies.transcribeAudio) {
      throw new Error('Telegram voice transcription is unavailable.');
    }
    const token = this.dependencies.readBotToken();
    if (!token) return undefined;
    const file = await this.telegramRequest<{ file_path?: string }>(token, 'getFile', { file_id: voice.file_id });
    if (!file.file_path) return undefined;
    const fetchImpl = this.dependencies.fetch ?? fetch;
    const response = await fetchImpl(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!response.ok) return undefined;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return this.dependencies.transcribeAudio({
      dataBase64: bytesToBase64(bytes),
      mimeType: voice.mime_type || response.headers.get('content-type') || 'audio/ogg',
      fileName: file.file_path.split('/').pop() || 'telegram-voice.ogg',
    });
  }

  private startTyping(chatId: string): void {
    if (this.typingIndicators.has(chatId)) return;
    const token = this.dependencies.readBotToken();
    if (!token) return;
    const indicator = new TypingIndicator(() => this.telegramRequest(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }));
    this.typingIndicators.set(chatId, indicator);
    indicator.start();
  }

  private stopTyping(chatId: string): void {
    this.typingIndicators.get(chatId)?.stop();
    this.typingIndicators.delete(chatId);
  }

  private async sendMessage(chatId: string, text: string, options: TelegramSendMessageOptions = {}): Promise<TelegramSentMessage | null> {
    const token = this.dependencies.readBotToken();
    if (!token) return null;
    const chunks = splitTelegramMessage(text).map(renderTelegramHtml);
    let lastMessage: TelegramSentMessage | null = null;
    for (const [index, chunk] of chunks.entries()) {
      lastMessage = await this.telegramRequest<TelegramSentMessage>(token, 'sendMessage', {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(index === chunks.length - 1 ? options : {}),
      });
    }
    return lastMessage;
  }

  private async editMessage(chatId: string, messageId: number, text: string): Promise<void> {
    const edited = await this.tryEditMessage(chatId, messageId, text);
    if (!edited) {
      await this.sendMessage(chatId, text);
    }
  }

  private async tryEditMessage(chatId: string, messageId: number, text: string): Promise<boolean> {
    const token = this.dependencies.readBotToken();
    if (!token) return false;
    const chunks = splitTelegramMessage(text);
    const [firstChunk = '', ...remainingChunks] = chunks;
    try {
      await this.telegramRequest(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: renderTelegramHtml(firstChunk),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    } catch {
      return false;
    }
    for (const chunk of remainingChunks) {
      await this.sendMessage(chatId, chunk);
    }
    return true;
  }

  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    const token = this.dependencies.readBotToken();
    if (!token) return;
    await this.telegramRequest(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId });
  }

  private async telegramRequest<T>(token: string, method: string, body: unknown, signal = this.abortController?.signal): Promise<T> {
    const fetchImpl = this.dependencies.fetch ?? fetch;
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const payload = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.description || `Telegram ${method} failed`);
    }
    return payload.result as T;
  }
}

export function renderTelegramHtml(markdown: string): string {
  const segments: string[] = [];
  let cursor = 0;
  const fencePattern = /```([\w.-]+)?\n([\s\S]*?)```/g;
  for (const match of markdown.matchAll(fencePattern)) {
    const index = match.index ?? 0;
    segments.push(renderTelegramInlineMarkdown(markdown.slice(cursor, index)));
    const language = match[1]?.trim();
    const code = match[2] ?? '';
    segments.push(`<pre>${escapeTelegramHtml(language ? `${language}\n${code}` : code)}</pre>`);
    cursor = index + match[0].length;
  }
  segments.push(renderTelegramInlineMarkdown(markdown.slice(cursor)));
  return segments.join('').trim() || escapeTelegramHtml(markdown);
}

export function buildTelegramPromptText(input: { text?: string; hasPhoto?: boolean; voiceTranscript?: string }): string {
  const parts: string[] = [];
  const transcript = input.voiceTranscript?.trim();
  if (transcript) {
    parts.push(`[The user sent a Telegram voice message. Transcript: "${transcript}"]`);
  }
  const text = input.text?.trim();
  if (text) {
    parts.push(text);
  }
  if (input.hasPhoto && !text && !transcript) {
    parts.push('Please review this Telegram photo.');
  } else if (input.hasPhoto && transcript) {
    parts.push('[The user also attached a Telegram photo.]');
  }
  return parts.join('\n\n').trim() || 'Please review this Telegram message.';
}

export function renderTelegramToolStatus(status: TelegramToolStatus): string {
  const marker = status.status === 'running' ? '🔧' : status.status === 'error' ? '⚠️' : '✓';
  const state = status.status === 'running' ? 'Running' : status.status === 'error' ? 'Failed' : 'Done';
  return `${marker} ${state}: ${status.summary}`;
}

export function formatTelegramToolSummary(toolName: string, args: unknown): string {
  const normalizedName = normalizeTelegramToolName(toolName);
  const detail = readTelegramToolDetail(normalizedName, args);
  return truncateTelegramStatus(detail ? `${normalizedName}: ${detail}` : normalizedName, TELEGRAM_TOOL_STATUS_LIMIT);
}

export function splitTelegramMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT * 0.8) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > TELEGRAM_MESSAGE_LIMIT) {
    const slice = remaining.slice(0, TELEGRAM_MESSAGE_LIMIT);
    const splitAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('\n'), slice.lastIndexOf(' '));
    const boundary = splitAt > TELEGRAM_MESSAGE_LIMIT * 0.5 ? splitAt : TELEGRAM_MESSAGE_LIMIT;
    chunks.push(remaining.slice(0, boundary).trimEnd());
    remaining = remaining.slice(boundary).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function normalizeTelegramToolName(toolName: string): string {
  const trimmed = toolName.trim();
  if (!trimmed) return 'tool';
  const parts = trimmed.split('.');
  return parts.at(-1) || trimmed;
}

function readTelegramToolDetail(toolName: string, args: unknown): string {
  if (typeof args === 'string') return args.trim();
  if (!args || typeof args !== 'object') return '';
  const record = args as Record<string, unknown>;
  const preferredKeys =
    toolName === 'bash' || toolName === 'exec_command' || toolName === 'shell'
      ? ['cmd', 'command', 'script']
      : ['query', 'q', 'path', 'file', 'url', 'message', 'text', 'name', 'action'];
  for (const key of preferredKeys) {
    const value = readShortTelegramValue(record[key]);
    if (value) return value;
  }
  for (const [key, value] of Object.entries(record)) {
    const rendered = readShortTelegramValue(value);
    if (rendered) return `${key}=${rendered}`;
  }
  return '';
}

function readShortTelegramValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const first = value.map(readShortTelegramValue).find(Boolean);
    return first ? `[${first}]` : '';
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['q', 'query', 'path', 'url', 'text', 'name']) {
      const rendered = readShortTelegramValue(record[key]);
      if (rendered) return rendered;
    }
  }
  return '';
}

function truncateTelegramStatus(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function renderTelegramInlineMarkdown(text: string): string {
  const normalized = normalizeMarkdownTables(normalizeTaskLists(text));
  const escaped = escapeTelegramHtml(normalized);
  return escaped
    .replace(/^###\s+(.+)$/gm, '<b>$1</b>')
    .replace(/^##\s+(.+)$/gm, '<b>$1</b>')
    .replace(/^#\s+(.+)$/gm, '<b>$1</b>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n][\s\S]*?[^*\n])\*\*/g, '<b>$1</b>')
    .replace(/__([^_\n][\s\S]*?[^_\n])__/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
}

function normalizeTaskLists(text: string): string {
  return text.replace(/^\s*[-*]\s+\[([ xX])]\s+(.+)$/gm, (_match, checked: string, label: string) => {
    return `${checked.trim().toLowerCase() === 'x' ? '☑' : '☐'} ${label}`;
  });
}

function normalizeMarkdownTables(text: string): string {
  const lines = text.split('\n');
  const output: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = parseMarkdownTableRow(lines[index] ?? '');
    const divider = lines[index + 1] ?? '';
    if (header && isMarkdownTableDivider(divider)) {
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const row = parseMarkdownTableRow(lines[index] ?? '');
        if (!row) break;
        rows.push(row);
        index += 1;
      }
      index -= 1;
      output.push(formatMarkdownTable(header, rows));
    } else {
      output.push(lines[index] ?? '');
    }
  }
  return output.join('\n');
}

function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  return cells.length >= 2 && cells.some(Boolean) ? cells : null;
}

function isMarkdownTableDivider(line: string): boolean {
  const cells = parseMarkdownTableRow(line);
  return Boolean(cells && cells.every((cell) => /^:?-{3,}:?$/.test(cell)));
}

function formatMarkdownTable(header: string[], rows: string[][]): string {
  if (rows.length === 0) return header.join(' · ');
  if (header.length <= 4 && rows.every((row) => row.every((cell) => cell.length <= 48))) {
    return rows
      .map((row) => row.map((cell, index) => `${header[index] || `Column ${index + 1}`}: ${cell || '—'}`).join('\n'))
      .map((row) => `• ${row.replace(/\n/g, '\n  ')}`)
      .join('\n');
  }
  const allRows = [header, ...rows];
  const widths = header.map((_, column) => Math.min(32, Math.max(...allRows.map((row) => (row[column] || '').length))));
  return allRows.map((row) => row.map((cell, column) => (cell || '').padEnd(widths[column] ?? 0)).join('  ')).join('\n');
}

function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function statusKeyboard(): { inline_keyboard: TelegramInlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: 'Threads', callback_data: 'cmd:/threads' },
        { text: 'Model', callback_data: 'cmd:/model' },
      ],
      [
        { text: 'Pause replies', callback_data: 'cmd:/stop' },
        { text: 'Resume replies', callback_data: 'cmd:/resume' },
      ],
      [
        { text: 'Compact', callback_data: 'cmd:/compact' },
        { text: 'Title', callback_data: 'cmd:/title' },
      ],
      [
        { text: 'Detach', callback_data: 'cmd:/detach' },
        { text: 'Archive', callback_data: 'cmd:/archive' },
      ],
      [{ text: 'Help', callback_data: 'cmd:/help' }],
    ],
  };
}

function isTelegramSilenceToken(text: string): boolean {
  return /^(?:\[?SILENT\]?|NO[_\s-]?REPLY)$/i.test(text.trim());
}

function commandKeyboard(): { inline_keyboard: TelegramInlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: 'Threads', callback_data: 'cmd:/threads' },
        { text: 'New thread', callback_data: 'cmd:/new' },
      ],
      [
        { text: 'Status', callback_data: 'cmd:/status' },
        { text: 'Who am I?', callback_data: 'cmd:/whoami' },
      ],
      [{ text: 'Help', callback_data: 'cmd:/help' }],
    ],
  };
}

function truncateButtonText(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 36 ? `${trimmed.slice(0, 33)}…` : trimmed;
}

function formatTelegramChatLabel(chat: TelegramChat): string {
  if (chat.title?.trim()) return chat.title.trim();
  const name = [chat.first_name, chat.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || chat.username || String(chat.id);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
