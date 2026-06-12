let localBackendBaseUrl: string | undefined;

export function setLocalBackendBaseUrl(value: string | undefined): void {
  localBackendBaseUrl = value;
}

export function getLocalBackendBaseUrl(): string | undefined {
  return localBackendBaseUrl;
}
