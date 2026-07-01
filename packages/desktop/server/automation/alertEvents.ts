import { type AlertRecord, type ResolveAlertOptions, upsertAlert } from '@neon-pilot/core';

import { publishExtensionHostEvent } from '../extensions/extensionSubscriptions.js';
import { logError } from '../shared/logging.js';

export interface AlertHostEventPayload {
  type: 'upserted' | 'acknowledged' | 'dismissed';
  alert: AlertRecord;
}

function publishAlertHostEvent(payload: AlertHostEventPayload): void {
  void publishExtensionHostEvent('alerts', payload).catch((error) => {
    logError('alert host event publish failed', {
      alertId: payload.alert.id,
      eventType: payload.type,
      message: error instanceof Error ? error.message : String(error),
    });
  });
}

export function publishAlertUpserted(alert: AlertRecord): void {
  publishAlertHostEvent({ type: 'upserted', alert });
}

export function publishAlertAcknowledged(alert: AlertRecord): void {
  publishAlertHostEvent({ type: 'acknowledged', alert });
}

export function publishAlertDismissed(alert: AlertRecord): void {
  publishAlertHostEvent({ type: 'dismissed', alert });
}

export function upsertAlertAndPublish(
  options: ResolveAlertOptions & {
    alert: Omit<AlertRecord, 'updatedAt'> & { updatedAt?: string };
  },
): AlertRecord {
  const alert = upsertAlert(options);
  publishAlertUpserted(alert);
  return alert;
}
