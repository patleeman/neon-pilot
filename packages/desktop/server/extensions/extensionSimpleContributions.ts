import type { ExtensionMentionContribution, ExtensionModelProfileContribution, ExtensionPackageType } from './extensionManifest.js';

export interface ExtensionMentionRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  title: string;
  description?: string;
  kinds: string[];
  provider: string;
}

export interface ExtensionModelProfileRegistration {
  extensionId: string;
  packageType: ExtensionPackageType;
  id: string;
  title?: string;
  description?: string;
  match: string[];
  priority: number;
}

export function buildExtensionMentionRegistrations(input: {
  extensionId: string;
  packageType?: ExtensionPackageType;
  mentions?: ExtensionMentionContribution[];
}): ExtensionMentionRegistration[] {
  return (input.mentions ?? []).flatMap((mention): ExtensionMentionRegistration[] => {
    const id = mention.id.trim();
    const provider = mention.provider.trim();
    if (!id || !mention.title.trim() || !provider) return [];
    return [
      {
        extensionId: input.extensionId,
        packageType: input.packageType ?? 'user',
        id,
        title: mention.title,
        ...(mention.description ? { description: mention.description } : {}),
        kinds: mention.kinds,
        provider,
      },
    ];
  });
}

export function buildExtensionModelProfileRegistrations(input: {
  extensionId: string;
  packageType?: ExtensionPackageType;
  profiles?: ExtensionModelProfileContribution[];
}): ExtensionModelProfileRegistration[] {
  return (input.profiles ?? []).flatMap((profile): ExtensionModelProfileRegistration[] => {
    const id = profile.id.trim();
    const match = Array.isArray(profile.match) ? profile.match.map((pattern) => pattern.trim()).filter(Boolean) : [];
    if (!id || match.length === 0) return [];
    return [
      {
        extensionId: input.extensionId,
        packageType: input.packageType ?? 'user',
        id,
        ...(profile.title ? { title: profile.title } : {}),
        ...(profile.description ? { description: profile.description } : {}),
        match,
        priority: Number.isFinite(profile.priority) ? Number(profile.priority) : 0,
      },
    ];
  });
}
