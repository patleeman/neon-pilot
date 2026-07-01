export type AlertSeverityFilter = 'disruptive' | 'all';

export const ALERT_SOUND_IDS = [
  'basso',
  'blow',
  'bottle',
  'frog',
  'funk',
  'glass',
  'hero',
  'morse',
  'ping',
  'pop',
  'purr',
  'sosumi',
  'submarine',
  'tink',
] as const;

export type AlertSoundId = (typeof ALERT_SOUND_IDS)[number];

export interface AlertsSettings {
  enabled: boolean;
  nativeNotifications: boolean;
  soundEnabled: boolean;
  severity: AlertSeverityFilter;
  sound: AlertSoundId;
}

export interface AlertsSettingsState {
  settings: AlertsSettings;
  systemNotificationsAvailable: boolean;
}

export interface AlertRecord {
  id: string;
  kind: string;
  severity: 'passive' | 'disruptive';
  status: 'active' | 'acknowledged' | 'dismissed';
  title: string;
  body: string;
  updatedAt: string;
  conversationId?: string;
  requiresAck?: boolean;
  sourceKind?: string;
  sourceId?: string;
}

export interface AlertSubscriptionEvent {
  subscriptionId?: string;
  event?: string;
  payload?: {
    type?: string;
    alert?: AlertRecord;
  };
  sourceExtensionId?: string;
}
