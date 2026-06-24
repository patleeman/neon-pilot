import type { AddNotificationPayload } from '../components/notifications/notificationStore';
import type { ExtensionCommandRegistration } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function hasStatusFields(record: Record<string, unknown>): boolean {
  return ['installed', 'version', 'telemetry', 'health'].some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function isInternalDiagnosticMessage(value: string): boolean {
  return (
    value.includes('\n') ||
    /Local API route did not complete/i.test(value) ||
    /\/api\//i.test(value) ||
    /file:\/\//i.test(value) ||
    /\s+at\s+\S+/i.test(value) ||
    /\bModule\.[A-Za-z_$][\w$]*/.test(value)
  );
}

function readUserMessage(record: Record<string, unknown>, command: ExtensionCommandRegistration, ok: boolean | null): string | null {
  const message = readString(record, 'message');
  if (message && !isInternalDiagnosticMessage(message)) return message;
  if (ok === false) return `${command.title} failed.`;
  if (hasStatusFields(record)) return `${command.title} finished.`;
  return null;
}

function buildDetails(record: Record<string, unknown>): string | undefined {
  const details = [
    readString(record, 'installHint'),
    readString(record, 'version') ? `Version: ${readString(record, 'version')}` : null,
    readString(record, 'telemetry') ? `Telemetry: ${readString(record, 'telemetry')}` : null,
  ].filter((line): line is string => Boolean(line));
  return details.length ? details.join('\n') : undefined;
}

export function buildExtensionCommandNotification(command: ExtensionCommandRegistration, result: unknown): AddNotificationPayload | null {
  if (!isRecord(result)) return null;

  const ok = typeof result.ok === 'boolean' ? result.ok : null;
  const message = readUserMessage(result, command, ok);
  if (!message) return null;

  return {
    type: ok === false ? 'warning' : 'info',
    message,
    details: buildDetails(result),
    source: command.category ?? command.title ?? command.extensionId,
  };
}
