import type { ExtensionHostRequest } from '../../server/extensions/extensionHostProtocol.js';

export function withRpcAbortSignal(request: ExtensionHostRequest, signal: AbortSignal): ExtensionHostRequest {
  if (request.type === 'invokeAction') {
    const agentToolContext =
      request.agentToolContext && typeof request.agentToolContext === 'object' && !Array.isArray(request.agentToolContext)
        ? { ...(request.agentToolContext as Record<string, unknown>), signal }
        : request.agentToolContext;
    return {
      ...request,
      signal,
      ...(agentToolContext ? { agentToolContext } : {}),
    };
  }
  if (request.type === 'invokeProtocolEntrypoint') {
    return { ...request, signal };
  }
  return request;
}
