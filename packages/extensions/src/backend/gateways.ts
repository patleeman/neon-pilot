function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/gateways must be resolved by the Neon Pilot host runtime.');
}

export type GatewayProviderId = string;
export type GatewayStatus = 'needs_config' | 'connected' | 'active' | 'paused' | 'needs_attention';
export type GatewayEventKind = 'inbound' | 'outbound' | 'routing' | 'status' | 'error';

export interface GatewayProviderSummary {
  id: GatewayProviderId;
  label: string;
  description?: string;
  icon?: string;
  implemented: boolean;
  configurationLocation: 'gateways' | 'settings' | 'extension' | 'external';
  extensionId?: string;
  setupRoute?: string;
  docsUrl?: string;
  order?: number;
}

export interface GatewayConnection {
  id: string;
  provider: GatewayProviderId;
  label: string;
  status: GatewayStatus;
  enabled: boolean;
  statusMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayThreadBinding {
  id: string;
  provider: GatewayProviderId;
  connectionId: string;
  conversationId: string;
  conversationTitle?: string;
  externalChatId?: string;
  externalChatLabel?: string;
  repliesEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayState {
  providers: GatewayProviderSummary[];
  connections: GatewayConnection[];
  bindings: GatewayThreadBinding[];
  chatTargets: Array<{
    id: string;
    provider: GatewayProviderId;
    connectionId: string;
    externalChatId: string;
    externalChatLabel?: string;
    conversationId: string;
    conversationTitle?: string;
    lastExternalMessageId?: string;
    repliesEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  events: Array<{
    id: string;
    provider: GatewayProviderId;
    conversationId?: string;
    kind: GatewayEventKind;
    message: string;
    createdAt: string;
  }>;
}

export const startTelegramGatewayService = (..._args: unknown[]): unknown => hostResolved();
export const stopTelegramGatewayService = (..._args: unknown[]): unknown => hostResolved();
export const readTelegramGatewayServiceStatus = (..._args: unknown[]): unknown => hostResolved();
export const readGatewayState = (): Promise<GatewayState | null> => hostResolved();
export const ensureGatewayConnection = (_input: { provider: GatewayProviderId }): Promise<GatewayState | null> => hostResolved();
export const updateGatewayConnectionStatus = (_input: {
  provider: GatewayProviderId;
  status: GatewayStatus;
  enabled?: boolean;
  statusMessage?: string;
}): Promise<GatewayState | null> => hostResolved();
export const attachGatewayConversation = (_input: {
  provider: GatewayProviderId;
  conversationId: string;
  conversationTitle?: string;
  externalChatId?: string;
  externalChatLabel?: string;
}): Promise<GatewayState | null> => hostResolved();
export const detachGatewayConversation = (_input: {
  provider?: GatewayProviderId;
  conversationId: string;
}): Promise<GatewayState | null> => hostResolved();
export const recordGatewayEvent = (_input: {
  provider: GatewayProviderId;
  conversationId?: string;
  kind: GatewayEventKind;
  message: string;
}): Promise<GatewayState | null> => hostResolved();
