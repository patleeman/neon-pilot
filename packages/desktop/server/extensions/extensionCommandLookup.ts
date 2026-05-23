export function isExtensionCommandRegistrationMatch(command: { extensionId: string; surfaceId: string }, commandId: string): boolean {
  return `${command.extensionId}.${command.surfaceId}` === commandId || command.surfaceId === commandId;
}

export function findExtensionCommandRegistration<TCommand extends { extensionId: string; surfaceId: string }>(
  commands: TCommand[],
  commandId: string,
): TCommand | undefined {
  return commands.find((command) => isExtensionCommandRegistrationMatch(command, commandId));
}
