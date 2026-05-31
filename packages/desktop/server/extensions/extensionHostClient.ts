import type { ExtensionBackendContext, ExtensionBackendServerContext, ExtensionActionInvokeResult } from './extensionBackend.js';

export interface ExtensionHostInvokeActionInput {
  extensionId: string;
  actionId: string;
  input: unknown;
  serverContext?: ExtensionBackendServerContext;
  toolContext?: ExtensionBackendContext['toolContext'];
  agentToolContext?: unknown;
}

export interface ExtensionHostClient {
  invokeAction(input: ExtensionHostInvokeActionInput): Promise<ExtensionActionInvokeResult>;
}

let configuredExtensionHostClient: ExtensionHostClient | undefined;

export function setExtensionHostClient(client: ExtensionHostClient | undefined): void {
  configuredExtensionHostClient = client;
}

export function getExtensionHostClient(): ExtensionHostClient {
  configuredExtensionHostClient ??= createInProcessExtensionHostClient();
  return configuredExtensionHostClient;
}

export function createInProcessExtensionHostClient(): ExtensionHostClient {
  return {
    async invokeAction(input) {
      const { invokeExtensionAction } = await import('./extensionBackend.js');
      return invokeExtensionAction(
        input.extensionId,
        input.actionId,
        input.input,
        input.serverContext,
        input.toolContext,
        input.agentToolContext,
      );
    },
  };
}
