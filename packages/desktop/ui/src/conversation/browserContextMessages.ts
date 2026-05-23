import { type DesktopWorkbenchBrowserCommentTarget, type DesktopWorkbenchBrowserState, getDesktopBridge } from '../desktop/desktopBridge';

export interface PendingBrowserComment {
  id: string;
  createdAt: string;
  target: DesktopWorkbenchBrowserCommentTarget;
  comment: string;
}

export function isPendingBrowserComment(value: unknown): value is PendingBrowserComment {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const comment = value as Partial<PendingBrowserComment>;
  return (
    typeof comment.id === 'string' &&
    typeof comment.createdAt === 'string' &&
    typeof comment.comment === 'string' &&
    Boolean(comment.target) &&
    typeof comment.target?.url === 'string'
  );
}

export function formatBrowserCommentTargetLabel(target: DesktopWorkbenchBrowserCommentTarget): string {
  const role = target.role?.trim() || 'element';
  const name = target.accessibleName?.trim() || target.textSnippet?.trim() || target.selector?.trim() || target.url;
  return `${role}${name ? `: ${name}` : ''}`;
}

export function formatBrowserCommentsContext(comments: PendingBrowserComment[]): string {
  const lines = ['Browser comments from the workbench:'];
  comments.forEach((entry, index) => {
    const target = entry.target;
    lines.push('', `Comment ${index + 1}:`, `URL: ${target.url}`, `Page title: ${target.title || '(untitled)'}`);
    lines.push(`Target: ${formatBrowserCommentTargetLabel(target)}`);
    if (target.selector) lines.push(`Selector: ${target.selector}`);
    if (target.xpath) lines.push(`XPath: ${target.xpath}`);
    if (target.testId) lines.push(`Test id: ${target.testId}`);
    if (target.textSnippet) lines.push(`Element text: ${target.textSnippet}`);
    if (target.surroundingText) lines.push(`Nearby text: ${target.surroundingText}`);
    if (target.elementHtmlPreview) lines.push(`Element HTML preview: ${target.elementHtmlPreview}`);
    lines.push(
      `Viewport rect: x=${target.viewportRect.x}, y=${target.viewportRect.y}, width=${target.viewportRect.width}, height=${target.viewportRect.height}`,
    );
    lines.push(`User comment: ${entry.comment}`);
  });
  return lines.join('\n');
}

export function buildBrowserCommentContextMessages(
  comments: PendingBrowserComment[],
): Array<{ customType: string; content: string }> | undefined {
  if (comments.length === 0) {
    return undefined;
  }
  return [{ customType: 'browser-comments', content: formatBrowserCommentsContext(comments) }];
}

export function buildBrowserChangedContextMessage(
  state: DesktopWorkbenchBrowserState | null,
): { customType: string; content: string } | null {
  if (!state?.changedSinceLastSnapshot) {
    return null;
  }

  return {
    customType: 'browser-changed-since-snapshot',
    content: [
      'The Workbench Browser changed after the agent last snapshotted it. The user may have navigated, logged in, typed, clicked, or otherwise changed page state manually.',
      `Current URL: ${state.url || '(unknown)'}`,
      `Current title: ${state.title || '(untitled)'}`,
      `Current loading state: ${state.loading ? 'loading' : 'not loading'}`,
      `Browser revision: ${state.browserRevision ?? 'unknown'}`,
      `Last snapshot revision: ${state.lastSnapshotRevision ?? 'unknown'}`,
      state.lastChangeReason ? `Last change reason: ${state.lastChangeReason}` : '',
      state.lastChangedAt ? `Last changed at: ${state.lastChangedAt}` : '',
      'Take a fresh browser_snapshot before relying on prior page observations.',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export async function readBrowserChangedContextMessage(sessionKey: string): Promise<{ customType: string; content: string } | null> {
  const bridge = getDesktopBridge();
  if (!bridge?.getWorkbenchBrowserState) {
    return null;
  }

  try {
    return buildBrowserChangedContextMessage(await bridge.getWorkbenchBrowserState({ sessionKey }));
  } catch {
    return null;
  }
}

export function mergeContextMessages(
  ...groups: Array<Array<{ customType: string; content: string }> | undefined>
): Array<{ customType: string; content: string }> | undefined {
  const messages = groups.flatMap((group) => group ?? []);
  return messages.length > 0 ? messages : undefined;
}

export function buildBrowserCommentsStorageKey(draft: boolean, conversationId: string | undefined): string | null {
  if (draft) {
    return 'pa:reload:draft-conversation:browser-comments';
  }
  return conversationId ? `pa:reload:conversation:${conversationId}:browser-comments` : null;
}

export function normalizePendingBrowserComments(value: unknown): PendingBrowserComment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isPendingBrowserComment).slice(0, 20);
}
