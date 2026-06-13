function hostResolved(): never {
  throw new Error('@neon-pilot/extensions/backend/modelGateway must be resolved by the Neon Pilot host runtime.');
}

export const DEFAULT_MODEL_GATEWAY_PORT = 8766;
export const FAKE_MODEL_GATEWAY_MODEL_ID = 'neon-pilot-fake';
export const DEFAULT_MODEL_GATEWAY_MODEL_ID = 'auto';

export interface ModelGatewaySettings {
  port: number;
  host: string;
  defaultModel: string;
}

export interface ModelGatewayModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ModelGatewayStatus {
  running: boolean;
  host: string;
  port: number;
  baseUrl: string;
  models: number;
  defaultModel: string;
  lastError?: string;
}

export interface ResponsesRequest {
  model?: unknown;
  input?: unknown;
  instructions?: unknown;
  tools?: unknown;
  stream?: unknown;
  temperature?: unknown;
  max_output_tokens?: unknown;
  reasoning?: unknown;
  metadata?: unknown;
}

export interface ResponsesResponse {
  id: string;
  object: 'response';
  created_at: number;
  status: 'completed' | 'failed';
  model: string;
  output: Array<Record<string, unknown>>;
  usage?: Record<string, unknown>;
  error?: { message: string };
}

export interface ModelGatewayRuntimeContext {
  runtimeDir: string;
}

export const modelGatewaySettingsFrom = (_value: unknown): Promise<ModelGatewaySettings> => hostResolved();
export const listModelGatewayModels = (_ctx: ModelGatewayRuntimeContext): Promise<ModelGatewayModel[]> => hostResolved();
export const createModelGatewayResponse = (
  _ctx: ModelGatewayRuntimeContext,
  _body: ResponsesRequest,
  _settings: ModelGatewaySettings,
): Promise<ResponsesResponse> => hostResolved();
export const streamModelGatewayResponseEvents = (
  _ctx: ModelGatewayRuntimeContext,
  _body: ResponsesRequest,
  _settings: ModelGatewaySettings,
): AsyncIterable<Record<string, unknown> | '[DONE]'> => hostResolved();
