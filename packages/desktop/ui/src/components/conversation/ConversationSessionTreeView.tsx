import { useEffect, useMemo, useState } from 'react';

import { api } from '../../client/api';
import type { ConversationSessionTree, ConversationSessionTreeNode } from '../../shared/types';

interface ConversationSessionTreeViewProps {
  conversationId: string;
  onOpenNode?: (nodeId: string) => void;
}

function nodeTone(node: ConversationSessionTreeNode): string {
  if (node.status === 'failed' || node.status === 'error') return 'text-danger';
  if (node.status === 'completed' || node.status === 'done' || node.status === 'stop') return 'text-success';
  if (node.kind === 'tool_call' || node.role === 'toolResult') return 'text-steel';
  if (node.kind === 'branch_summary' || node.kind === 'compaction') return 'text-accent';
  return 'text-secondary';
}

function nodeGlyph(node: ConversationSessionTreeNode): string {
  if (node.kind === 'session') return '◎';
  if (node.kind === 'message' && node.role === 'user') return 'u';
  if (node.kind === 'message' && node.role === 'assistant') return 'a';
  if (node.kind === 'message' && node.role === 'toolResult') return '↳';
  if (node.kind === 'custom_message') return '◆';
  if (node.kind === 'branch_summary') return '⑂';
  if (node.kind === 'compaction') return '◌';
  if (node.kind === 'model_change') return 'm';
  return '•';
}

function buildTreeRows(nodes: ConversationSessionTreeNode[]): Array<{ node: ConversationSessionTreeNode; depth: number }> {
  const visibleNodes = nodes.filter((node) => ['session', 'message', 'custom_message', 'compaction', 'branch_summary'].includes(node.kind));
  const visibleIdSet = new Set(visibleNodes.map((node) => node.id));
  const rawNodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const childrenByParentId = new Map<string, ConversationSessionTreeNode[]>();
  const roots: ConversationSessionTreeNode[] = [];

  function nearestVisibleParentId(node: ConversationSessionTreeNode): string | null {
    let parentId = node.parentId;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      if (visibleIdSet.has(parentId)) return parentId;
      seen.add(parentId);
      parentId = rawNodeById.get(parentId)?.parentId ?? null;
    }
    return null;
  }

  for (const node of visibleNodes) {
    const parentId = nearestVisibleParentId(node);
    if (!parentId) {
      roots.push(node);
      continue;
    }
    const children = childrenByParentId.get(parentId) ?? [];
    children.push(node);
    childrenByParentId.set(parentId, children);
  }

  const rows: Array<{ node: ConversationSessionTreeNode; depth: number }> = [];
  const visited = new Set<string>();
  function visit(node: ConversationSessionTreeNode, depth: number) {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    rows.push({ node, depth });
    const children = childrenByParentId.get(node.id) ?? [];
    const childDepth = children.length > 1 ? depth + 1 : depth;
    for (const child of children) {
      visit(child, childDepth);
    }
  }

  for (const root of roots) visit(root, 0);
  for (const node of visibleNodes) visit(node, 0);
  return rows;
}

export function ConversationSessionTreeView({ conversationId, onOpenNode }: ConversationSessionTreeViewProps) {
  const [tree, setTree] = useState<ConversationSessionTree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .sessionTree(conversationId)
      .then((nextTree) => {
        if (!cancelled) setTree(nextTree);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const rows = useMemo(() => buildTreeRows(tree?.nodes ?? []), [tree?.nodes]);

  if (loading) {
    return <div className="px-6 py-8 text-[13px] text-secondary">Loading session tree…</div>;
  }

  if (error) {
    return <div className="px-6 py-8 text-[13px] text-danger">Unable to load session tree: {error}</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Session Tree</div>
          <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-primary">{tree?.title ?? 'Conversation'}</h2>
        </div>
        <div className="text-[11px] text-dim">{rows.length} nodes</div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface/35 p-2">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-secondary">No session tree nodes yet.</div>
        ) : (
          <div role="tree" aria-label="Session tree" className="space-y-1">
            {rows.map(({ node, depth }) => (
              <button
                key={node.id}
                type="button"
                role="treeitem"
                className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}
                onClick={() => onOpenNode?.(node.id)}
                title={node.id}
              >
                <span
                  className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-border-subtle text-[9px] ${nodeTone(node)}`}
                >
                  {nodeGlyph(node)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-5 text-primary">{node.title || node.kind}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-dim">
                    <span>{node.subtitle ?? node.kind}</span>
                    {node.status ? <span className={nodeTone(node)}>{node.status}</span> : null}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
