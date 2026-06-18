export interface ExtensionDesktopBridgeOpenResult {
  opened?: boolean;
  ok?: boolean;
  path?: string;
  url?: string;
  error?: string;
}

export interface ExtensionDesktopBridge {
  openPath?(targetPath: string): Promise<ExtensionDesktopBridgeOpenResult>;
  openExternalUrl?(targetUrl: string): Promise<ExtensionDesktopBridgeOpenResult>;
  writeClipboardText?(text: string): Promise<{ ok: true } | { ok: false; error?: string }>;
  getEnvironment?(): Promise<unknown>;
  readDesktopAppPreferences?(): Promise<unknown>;
  updateDesktopAppPreferences?(input: Record<string, unknown>): Promise<unknown>;
  checkForUpdates?(): Promise<unknown>;
  installReadyUpdate?(): Promise<unknown>;
  pickFolder?(input?: { cwd?: string | null; prompt?: string | null }): Promise<unknown>;
}
