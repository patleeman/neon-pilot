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
  startupAction?: string;
}

export function buildExtensionMentionRegistrations(input: {
  extensionId: string;
  packageType?: ExtensionPackageType;
  mentions?: ExtensionMentionContribution[];
}): ExtensionMentionRegistration[] {
  const mentions = Array.isArray(input.mentions) ? input.mentions : [];
  return mentions.flatMap((mention): ExtensionMentionRegistration[] => {
    if (!mention || typeof mention !== 'object') return [];
    const id = typeof mention.id === 'string' ? mention.id.trim() : '';
    const title = typeof mention.title === 'string' ? mention.title.trim() : '';
    const description = typeof mention.description === 'string' ? mention.description : undefined;
    const provider = typeof mention.provider === 'string' ? mention.provider.trim() : '';
    const kinds = Array.isArray(mention.kinds) ? mention.kinds.filter((kind): kind is string => typeof kind === 'string') : [];
    if (!id || !title || !provider || kinds.length === 0) return [];

    return [
      {
        extensionId: input.extensionId,
        packageType: input.packageType ?? 'user',
        id,
        title,
        ...(description ? { description } : {}),
        kinds,
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
        ...(profile.startupAction ? { startupAction: profile.startupAction } : {}),
      },
    ];
  });
}
