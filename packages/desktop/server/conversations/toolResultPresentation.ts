const EXTENSION_HOST_RPC_FAILURE_PATTERN = /^Extension host RPC request\s+(.+?)\s+failed at\s+https?:\/\/[^/]+\/action:\s+(.+)$/;
export const OVERSIZED_TOOL_OUTPUT_MAX_CHARS = 64 * 1024;
const OVERSIZED_TOOL_OUTPUT_MARKER = '[Neon Pilot truncated oversized tool output';

export function truncateOversizedToolOutput(
  value: string,
  maxChars = OVERSIZED_TOOL_OUTPUT_MAX_CHARS,
): { output: string; truncated: boolean; originalChars: number } {
  if (value.length <= maxChars) {
    return { output: value, truncated: false, originalChars: value.length };
  }

  const marker = `\n\n${OVERSIZED_TOOL_OUTPUT_MARKER}: ${value.length - maxChars} characters omitted]\n\n`;
  const budget = Math.max(0, maxChars - marker.length);
  const head = Math.ceil(budget * 0.6);
  const tail = Math.floor(budget * 0.4);
  return {
    output: `${value.slice(0, head)}${marker}${tail > 0 ? value.slice(-tail) : ''}`,
    truncated: true,
    originalChars: value.length,
  };
}

export function isToolResultOutputError(text: string): boolean {
  return EXTENSION_HOST_RPC_FAILURE_PATTERN.test(text.trim());
}

export function presentToolResultOutput(input: { text: string; isError: boolean }): string {
  const extensionHostRpcFailure = EXTENSION_HOST_RPC_FAILURE_PATTERN.exec(input.text.trim());
  if (!input.isError && !extensionHostRpcFailure) {
    return input.text;
  }

  if (!extensionHostRpcFailure) {
    return input.text;
  }

  const message = extensionHostRpcFailure[2]?.trim();
  if (/^This operation was aborted\.?$/i.test(message ?? '')) {
    return 'Stopped before finishing. The tool call was interrupted or cancelled.';
  }

  return message ? `Extension action failed: ${message}` : 'Extension action failed.';
}

export function presentTranscriptErrorMessage(message: string): string {
  const trimmed = message.trim();
  const providerMatch = /^Failed to resolve API key for provider\s+"([^"]+)"/i.exec(trimmed);
  if (providerMatch || /find-generic-password/i.test(trimmed)) {
    const provider = providerMatch?.[1]?.trim();
    return provider
      ? `No API key is available for provider "${provider}". Add one in Settings, then try again.`
      : 'No API key is available for the selected provider. Add one in Settings, then try again.';
  }

  return message;
}

export function presentToolUseOutput(input: { output: string; status?: 'running' | 'ok' | 'error' }): {
  output: string;
  status?: 'running' | 'ok' | 'error';
} {
  const isError = input.status === 'error' || isToolResultOutputError(input.output);
  const output = presentToolResultOutput({ text: input.output, isError });
  return {
    output,
    ...(isError ? { status: 'error' as const } : input.status ? { status: input.status } : {}),
  };
}
