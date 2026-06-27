import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface TelegramAccessPolicy {
  approvedUserIds: string[];
  approvedChatIds: string[];
}

const TELEGRAM_ACCESS_VERSION = 1;

interface PersistedTelegramAccessPolicy extends TelegramAccessPolicy {
  version: number;
}

export function resolveTelegramAccessFile(stateRoot: string, profile: string): string {
  return join(stateRoot, 'gateways', `telegram-access-${sanitizeProfileName(profile)}.json`);
}

export function readTelegramAccessPolicy(stateRoot: string, profile: string): TelegramAccessPolicy {
  const file = resolveTelegramAccessFile(stateRoot, profile);
  if (!existsSync(file)) return emptyPolicy();
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf-8')) as Partial<PersistedTelegramAccessPolicy>;
    return normalizeTelegramAccessPolicy(parsed);
  } catch {
    return emptyPolicy();
  }
}

export function writeTelegramAccessPolicy(stateRoot: string, profile: string, policy: TelegramAccessPolicy): TelegramAccessPolicy {
  const normalized = normalizeTelegramAccessPolicy(policy);
  const file = resolveTelegramAccessFile(stateRoot, profile);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ version: TELEGRAM_ACCESS_VERSION, ...normalized }, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  return normalized;
}

export function isTelegramMessageApproved(policy: TelegramAccessPolicy, input: { chatId: string; userId?: string }): boolean {
  const approvedChats = new Set(policy.approvedChatIds);
  const approvedUsers = new Set(policy.approvedUserIds);
  return approvedChats.has(input.chatId) || Boolean(input.userId && approvedUsers.has(input.userId));
}

export function hasTelegramAccessApprovals(policy: TelegramAccessPolicy): boolean {
  return policy.approvedChatIds.length > 0 || policy.approvedUserIds.length > 0;
}

function normalizeTelegramAccessPolicy(value: Partial<TelegramAccessPolicy>): TelegramAccessPolicy {
  return {
    approvedUserIds: normalizeIdList(value.approvedUserIds),
    approvedChatIds: normalizeIdList(value.approvedChatIds),
  };
}

function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => /^-?\d+$/.test(item)))];
}

function emptyPolicy(): TelegramAccessPolicy {
  return { approvedUserIds: [], approvedChatIds: [] };
}

function sanitizeProfileName(profile: string): string {
  return profile.replace(/[^a-zA-Z0-9_.-]+/g, '_') || 'default';
}
