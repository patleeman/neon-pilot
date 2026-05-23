export function getAssistantErrorDisplayMessage(message: { stopReason?: string; errorMessage?: string }): string | null {
  if (message.stopReason !== 'error') {
    return null;
  }

  const errorMessage = message.errorMessage?.trim();
  return errorMessage && errorMessage.length > 0 ? errorMessage : 'The model returned an error before completing its response.';
}
