export function buildCustomExtensionKeybindingRegistrations(input: {
  commandKeybindings?: Record<
    string,
    {
      extensionId: string;
      surfaceId: string;
      packageType?: string;
      title: string;
      command: string;
      args?: unknown;
      scope?: string;
      defaultKeys?: string[];
    }
  >;
  declaredKeys: Set<string>;
  disabledKeybindings: Set<string>;
  keybindingOverrides: Record<string, string[]>;
}) {
  const { commandKeybindings, declaredKeys, disabledKeybindings, keybindingOverrides } = input;
  return Object.entries(commandKeybindings ?? {}).flatMap(([registryKey, keybinding]) => {
    if (declaredKeys.has(registryKey)) return [];
    const keys = keybindingOverrides[registryKey] ?? keybinding.defaultKeys ?? [];
    return [
      {
        extensionId: keybinding.extensionId,
        surfaceId: keybinding.surfaceId,
        packageType: keybinding.packageType ?? (keybinding.extensionId === 'host' ? 'system' : 'user'),
        title: keybinding.title,
        keys,
        command: keybinding.command,
        ...(keybinding.args !== undefined ? { args: keybinding.args } : {}),
        scope: keybinding.scope ?? 'global',
        defaultKeys: keybinding.defaultKeys ?? [],
        enabled: !disabledKeybindings.has(registryKey),
      },
    ];
  });
}
