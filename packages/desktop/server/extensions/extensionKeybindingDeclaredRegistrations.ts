export function buildDeclaredExtensionKeybindingRegistrations(input: {
  extension: {
    id: string;
    packageType?: string;
    contributes?: {
      keybindings?: Array<{
        id: string;
        title: string;
        command: string;
        keys: string[];
        args?: unknown;
        when?: string;
        scope?: string;
      }>;
    };
  };
  disabledKeybindings: Set<string>;
  keybindingOverrides: Record<string, string[]>;
}) {
  const { extension, disabledKeybindings, keybindingOverrides } = input;
  return (extension.contributes?.keybindings ?? []).flatMap((keybinding) => {
    const id = keybinding.id.trim();
    const title = keybinding.title.trim();
    const command = keybinding.command.trim();
    const registryKey = `${extension.id}:${id}`;
    const defaultKeys = keybinding.keys.map((key) => key.trim()).filter(Boolean);
    const keys = keybindingOverrides[registryKey] ?? defaultKeys;
    if (!id || !title || !command || keys.length === 0) {
      return [];
    }
    return [
      {
        extensionId: extension.id,
        surfaceId: id,
        packageType: extension.packageType ?? 'user',
        title,
        keys,
        command,
        ...(keybinding.args !== undefined ? { args: keybinding.args } : {}),
        ...(keybinding.when ? { when: keybinding.when } : {}),
        scope: keybinding.scope ?? 'global',
        defaultKeys,
        enabled: !disabledKeybindings.has(registryKey),
      },
    ];
  });
}
