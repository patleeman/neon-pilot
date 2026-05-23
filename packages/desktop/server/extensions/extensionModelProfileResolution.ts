export interface ExtensionModelProfileMatch {
  extensionId: string;
  match: string[];
  priority: number;
}

export type ExtensionModelProfileResolution<TProfile extends ExtensionModelProfileMatch> =
  | { kind: 'none' }
  | { kind: 'resolved'; profile: TProfile }
  | { kind: 'ambiguous'; profiles: TProfile[] };

export function globMatches(pattern: string, value: string): boolean {
  const escaped = pattern
    .toLowerCase()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value.toLowerCase());
}

export function resolveExtensionModelProfileFromRegistrations<TProfile extends ExtensionModelProfileMatch>(input: {
  provider: string;
  model: string;
  profiles: TProfile[];
}): ExtensionModelProfileResolution<TProfile> {
  const modelRef = `${input.provider}/${input.model}`;
  const matches = input.profiles.filter((profile) => profile.match.some((pattern) => globMatches(pattern, modelRef)));
  if (matches.length === 0) return { kind: 'none' };
  const sorted = [...matches].sort((left, right) => right.priority - left.priority || left.extensionId.localeCompare(right.extensionId));
  const topPriority = sorted[0]?.priority ?? 0;
  const top = sorted.filter((profile) => profile.priority === topPriority);
  if (top.length > 1) return { kind: 'ambiguous', profiles: top };
  return { kind: 'resolved', profile: top[0]! };
}
