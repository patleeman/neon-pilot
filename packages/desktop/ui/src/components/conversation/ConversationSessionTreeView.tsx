import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';

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

function formatNodeTime(timestamp: string | undefined): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatNodeMeta(node: ConversationSessionTreeNode): string {
  return [node.status, formatNodeTime(node.timestamp)].filter(Boolean).join(' · ');
}

function buildTreeRows(nodes: ConversationSessionTreeNode[]): Array<{ node: ConversationSessionTreeNode; depth: number }> {
  const visibleNodes = nodes.filter(
    (node) => ['session', 'message', 'custom_message', 'compaction', 'branch_summary'].includes(node.kind) && node.role !== 'toolResult',
  );
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
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  useEffect(() => {
    setSelectedIndex(0);
  }, [conversationId, rows.length]);

  function handleTreeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (rows.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(rows.length - 1, index + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setSelectedIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSelectedIndex(rows.length - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = rows[selectedIndex]?.node;
      if (selected) onOpenNode?.(selected.id);
    }
  }

  if (loading) {
    return <div className="px-6 py-8 text-[13px] text-secondary">Loading session tree…</div>;
  }

  if (error) {
    return <div className="px-6 py-8 text-[13px] text-danger">Unable to load session tree: {error}</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 sm:px-6">
      <div className="mb-2 flex items-center justify-between text-[11px] text-dim">
        <div className="font-semibold uppercase tracking-[0.18em] text-accent">Session Tree</div>
        <div>{rows.length} nodes · ↑↓ select · Enter open</div>
      </div>

      <div>
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-secondary">No session tree nodes yet.</div>
        ) : (
          <div role="tree" aria-label="Session tree" tabIndex={0} className="outline-none" onKeyDown={handleTreeKeyDown}>
            {rows.map(({ node, depth }, index) => (
              <button
                key={node.id}
                type="button"
                role="treeitem"
                aria-selected={index === selectedIndex}
                className={[
                  'group flex h-6 w-full items-center gap-2 rounded-md px-1.5 text-left text-[12px] leading-6 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
                  index === selectedIndex ? 'bg-surface-hover/80 text-primary' : 'text-secondary',
                ].join(' ')}
                style={{ paddingLeft: `${0.25 + depth * 1.125}rem` }}
                onFocus={() => setSelectedIndex(index)}
                onClick={() => onOpenNode?.(node.id)}
                title={node.id}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded text-[10px] ${nodeTone(node)}`}>{nodeGlyph(node)}</span>
                <span className="min-w-0 flex-1 truncate text-primary">{node.title || node.kind}</span>
                <span className={`shrink-0 truncate text-[10px] uppercase tracking-[0.1em] ${nodeTone(node)}`}>{formatNodeMeta(node)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
