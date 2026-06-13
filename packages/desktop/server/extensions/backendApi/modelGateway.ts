import type {
  ModelGatewayModel,
  ModelGatewayRuntimeContext,
  ModelGatewaySettings,
  ResponsesRequest,
  ResponsesResponse,
} from '@neon-pilot/extensions/backend/modelGateway';

import { callServerModuleExport } from './serverModuleResolver.js';

const RUNTIME_MODULE = '../../modelGatewayRuntime.js';

export const DEFAULT_MODEL_GATEWAY_PORT = 8766;
export const FAKE_MODEL_GATEWAY_MODEL_ID = 'neon-pilot-fake';
export const DEFAULT_MODEL_GATEWAY_MODEL_ID = 'auto';
export type {
  ModelGatewayModel,
  ModelGatewayRuntimeContext,
  ModelGatewaySettings,
  ModelGatewayStatus,
  ResponsesRequest,
  ResponsesResponse,
} from '@neon-pilot/extensions/backend/modelGateway';

export function modelGatewaySettingsFrom(value: unknown): Promise<ModelGatewaySettings> {
  return callServerModuleExport(RUNTIME_MODULE, 'modelGatewaySettingsFrom', value);
}

export function listModelGatewayModels(ctx: ModelGatewayRuntimeContext): Promise<ModelGatewayModel[]> {
  return callServerModuleExport(RUNTIME_MODULE, 'listModelGatewayModels', ctx);
}

export function writeModelGatewayCatalog(ctx: ModelGatewayRuntimeContext): Promise<string> {
  return callServerModuleExport(RUNTIME_MODULE, 'writeModelGatewayCatalog', ctx);
}

export function createModelGatewayResponse(
  ctx: ModelGatewayRuntimeContext,
  body: ResponsesRequest,
  settings: ModelGatewaySettings,
): Promise<ResponsesResponse> {
  return callServerModuleExport(RUNTIME_MODULE, 'createModelGatewayResponse', ctx, body, settings) as Promise<ResponsesResponse>;
}

export async function streamModelGatewayResponseEvents(
  ctx: ModelGatewayRuntimeContext,
  body: ResponsesRequest,
  settings: ModelGatewaySettings,
): Promise<AsyncIterable<Record<string, unknown> | '[DONE]'>> {
  return callServerModuleExport(RUNTIME_MODULE, 'streamModelGatewayResponseEvents', ctx, body, settings) as Promise<
    AsyncIterable<Record<string, unknown> | '[DONE]'>
  >;
}
