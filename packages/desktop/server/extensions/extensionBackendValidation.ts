import { assertRecordArray, requireString, validateEnum, validateOptionalString } from './extensionManifestValidation.js';
import { isRecord } from './extensionRegistryConfig.js';

function validateOptionalWorker(value: unknown, path: string): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error(`Extension manifest ${path} must be an object.`);
  if (value.enabled !== undefined && typeof value.enabled !== 'boolean') {
    throw new Error(`Extension manifest ${path}.enabled must be a boolean.`);
  }
}

export function validateExtensionBackendContribution(backend: Record<string, unknown>): void {
  requireString(backend.entry, 'backend.entry');
  validateOptionalString(backend.agentExtension, 'backend.agentExtension');
  validateOptionalString(backend.startupAction, 'backend.startupAction');
  validateOptionalString(backend.onEnableAction, 'backend.onEnableAction');
  validateOptionalString(backend.onDisableAction, 'backend.onDisableAction');
  validateOptionalString(backend.onUninstallAction, 'backend.onUninstallAction');
  if (backend.services !== undefined) {
    for (const [index, service] of assertRecordArray(backend.services, 'backend.services').entries()) {
      requireString(service.id, `backend.services[${index}].id`);
      requireString(service.handler, `backend.services[${index}].handler`);
      validateOptionalString(service.title, `backend.services[${index}].title`);
      validateOptionalString(service.description, `backend.services[${index}].description`);
      validateOptionalString(service.healthCheck, `backend.services[${index}].healthCheck`);
      validateOptionalString(service.stopHandler, `backend.services[${index}].stopHandler`);
      if (service.restart !== undefined) {
        validateEnum(service.restart, ['never', 'on-failure', 'always'], `backend.services[${index}].restart`);
      }
    }
  }
  if (backend.actions !== undefined) {
    for (const [index, action] of assertRecordArray(backend.actions, 'backend.actions').entries()) {
      requireString(action.id, `backend.actions[${index}].id`);
      requireString(action.handler, `backend.actions[${index}].handler`);
      validateOptionalString(action.title, `backend.actions[${index}].title`);
      validateOptionalString(action.description, `backend.actions[${index}].description`);
    }
  }
  if (backend.protocolEntrypoints !== undefined) {
    for (const [index, entrypoint] of assertRecordArray(backend.protocolEntrypoints, 'backend.protocolEntrypoints').entries()) {
      requireString(entrypoint.id, `backend.protocolEntrypoints[${index}].id`);
      requireString(entrypoint.handler, `backend.protocolEntrypoints[${index}].handler`);
      validateOptionalString(entrypoint.title, `backend.protocolEntrypoints[${index}].title`);
      validateOptionalString(entrypoint.description, `backend.protocolEntrypoints[${index}].description`);
    }
  }
  if (backend.routes !== undefined) {
    for (const [index, route] of assertRecordArray(backend.routes, 'backend.routes').entries()) {
      validateEnum(route.method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], `backend.routes[${index}].method`);
      requireString(route.path, `backend.routes[${index}].path`);
      requireString(route.handler, `backend.routes[${index}].handler`);
      validateOptionalString(route.title, `backend.routes[${index}].title`);
      validateOptionalString(route.description, `backend.routes[${index}].description`);
      validateOptionalWorker(route.worker, `backend.routes[${index}].worker`);
      if (route.stream !== undefined) validateEnum(route.stream, ['sse'], `backend.routes[${index}].stream`);
      if (!(route.path as string).startsWith('/')) throw new Error(`backend.routes[${index}].path must start with /.`);
      if ((route.path as string).includes('..')) throw new Error(`backend.routes[${index}].path must not contain ..`);
    }
  }
}
