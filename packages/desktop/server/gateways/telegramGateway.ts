import {
  attachGatewayConversation,
  findGatewayChatTarget,
  findGatewayChatTargetByConversation,
  hasGatewayBinding,
  recordGatewayEvent,
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
  private nextOffset = 0;
  private typingIndicators = new Map<string, TypingIndicator>();

  constructor(private readonly dependencies: TelegramGatewayRuntimeDependencies) {}

  start(): void {
    if (this.polling) return;
    const token = this.dependencies.readBotToken();
    if (!token) return;
    this.abortController = new AbortController();
    this.polling = true;
    void this.configureBotCommands(token).catch(() => undefined);
    void this.pollLoop(token, this.abortController.signal);
  }

  stop(): void {
    this.polling = false;
    this.abortController?.abort();
    this.abortController = null;
    for (const indicator of this.typingIndicators.values()) indicator.stop();
    this.typingIndicators.clear();
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
      await this.handleCommand(command, { conversationId: target.conversationId, externalChatId, externalChatLabel });
      return;
    }

    if (!text && !message.photo?.length) {
      await this.sendMessage(externalChatId, 'Unsupported Telegram message type. Send text or a photo.');
      return;
    }

    const images = message.photo?.length ? await this.loadTelegramPhotos(message.photo) : undefined;
    this.startTyping(externalChatId);
    await this.dependencies.submitPrompt({
      conversationId: target.conversationId,
      text: text || 'Please review this Telegram photo.',
      images,
    });
  }

  async deliverAssistantReply(input: { conversationId: string; text: string }): Promise<boolean> {
    const text = input.text.trim();
    if (!text) return false;

    const target = findGatewayChatTargetByConversation({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      conversationId: input.conversationId,
    });
    if (!target) return false;

    this.stopTyping(target.externalChatId);
    await this.sendMessage(target.externalChatId, text);
    recordGatewayEvent({
      stateRoot: this.dependencies.stateRoot,
      profile: this.dependencies.profile,
      provider: 'telegram',
      conversationId: input.conversationId,
      kind: 'outbound',
      message: `Delivered assistant reply to ${target.externalChatLabel || target.externalChatId}`,
    });
    return true;
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
    await this.answerCallbackQuery(callback.id);
    const data = callback.data.trim();
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

    if (!hasGatewayBinding({ stateRoot: this.dependencies.stateRoot, profile: this.dependencies.profile, provider: 'telegram' })) {
      attachGatewayConversation({
        stateRoot: this.dependencies.stateRoot,
        profile: this.dependencies.profile,
        provider: 'telegram',
        conversationId: created.id,
        conversationTitle: title,
        externalChatId: input.externalChatId,
        externalChatLabel: input.externalChatLabel,
      });
    }

    await this.dependencies.renameConversation(created.id, title);
    return { conversationId: created.id, conversationTitle: title };
  }

  private async handleCommand(
    command: NonNullable<ReturnType<typeof parseTelegramGatewayCommand>>,
    target: { conversationId: string; externalChatId: string; externalChatLabel: string },
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
            reply_markup: await this.modelKeyboard(model ?? undefined),
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

  private async conversationKeyboard(): Promise<{ inline_keyboard: TelegramInlineKeyboardButton[][] }> {
    const conversations = (await this.dependencies.listConversations()).slice(0, 8);
    const rows = conversations.map((conversation, index) => [
      { text: `${index + 1}. ${truncateButtonText(conversation.title || conversation.id)}`, callback_data: `switch:${conversation.id}` },
    ]);
    rows.push([
      { text: 'New thread', callback_data: 'cmd:/new' },
      { text: 'Refresh list', callback_data: 'cmd:/threads' },
    ]);
    return { inline_keyboard: rows };
  }

  private async modelKeyboard(currentModel?: string): Promise<{ inline_keyboard: TelegramInlineKeyboardButton[][] }> {
    const models = (await this.dependencies.listModels()).slice(0, 12);
    const rows = models.map((model) => [
      {
        text: `${model.id === currentModel ? '✓ ' : ''}${truncateButtonText(model.label || model.id)}`,
        callback_data: `model:${model.id}`,
      },
    ]);
    rows.push([
      { text: 'Refresh models', callback_data: 'cmd:/model' },
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
        { command: 'new', description: 'Start a new Neon Pilot conversation' },
        { command: 'threads', description: 'List and switch conversations' },
        { command: 'model', description: 'Show or change the model' },
        { command: 'status', description: 'Show current gateway status' },
        { command: 'stop', description: 'Pause replies for this conversation' },
        { command: 'resume', description: 'Resume replies or switch to a named thread' },
        { command: 'compact', description: 'Compact the current thread' },
        { command: 'rename', description: 'Rename the current thread' },
        { command: 'archive', description: 'Archive and detach the thread' },
      ],
    });
  }

  private async pollLoop(token: string, signal: AbortSignal): Promise<void> {
    while (this.polling && !signal.aborted) {
      try {
        const updates = await this.telegramRequest<TelegramUpdate[]>(token, 'getUpdates', {
          timeout: 50,
          offset: this.nextOffset || undefined,
          allowed_updates: ['message', 'callback_query'],
        });
        for (const update of updates) {
          this.nextOffset = Math.max(this.nextOffset, update.update_id + 1);
          await this.processUpdate(update);
        }
      } catch (error) {
        if (signal.aborted) return;
        await sleep(10_000);
      }
    }
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

  private async sendMessage(chatId: string, text: string, options: TelegramSendMessageOptions = {}): Promise<void> {
    const token = this.dependencies.readBotToken();
    if (!token) return;
    const chunks = splitTelegramMessage(text).map(renderTelegramHtml);
    for (const [index, chunk] of chunks.entries()) {
      await this.telegramRequest(token, 'sendMessage', {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(index === chunks.length - 1 ? options : {}),
      });
    }
  }

  private async answerCallbackQuery(callbackQueryId: string): Promise<void> {
    const token = this.dependencies.readBotToken();
    if (!token) return;
    await this.telegramRequest(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId });
  }

  private async telegramRequest<T>(token: string, method: string, body: unknown): Promise<T> {
    const fetchImpl = this.dependencies.fetch ?? fetch;
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
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

function commandKeyboard(): { inline_keyboard: TelegramInlineKeyboardButton[][] } {
  return {
    inline_keyboard: [
      [
        { text: 'Threads', callback_data: 'cmd:/threads' },
        { text: 'New thread', callback_data: 'cmd:/new' },
      ],
      [
        { text: 'Status', callback_data: 'cmd:/status' },
        { text: 'Help', callback_data: 'cmd:/help' },
      ],
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
