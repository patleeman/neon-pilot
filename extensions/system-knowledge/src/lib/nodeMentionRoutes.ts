import type { MentionItem } from '@neon-pilot/extensions/data';

export type NodeMentionSurface = 'main' | 'compact';

export function buildNodeMentionHref(_item: MentionItem, _surface: NodeMentionSurface): string | null {
  return null;
}
