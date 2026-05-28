import type { ActivityTreeItem } from './activityTree';

interface ActivityTreePathEntry {
  item: ActivityTreeItem;
  path: string;
}

export interface ActivityTreePathModel {
  entries: ActivityTreePathEntry[];
  pathById: Map<string, string>;
  itemById: Map<string, ActivityTreeItem>;
  itemByPath: Map<string, ActivityTreeItem>;
  ancestorIdsById: Map<string, string[]>;
  paths: string[];
}

export function buildActivityTreePathModel(items: readonly ActivityTreeItem[]): ActivityTreePathModel {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const originalIndexById = new Map(items.map((item, index) => [item.id, index] as const));
  const pathById = new Map<string, string>();
  const logicalPathById = new Map<string, string>();
  const usedSiblingSlugsByParent = new Map<string, Set<string>>();

  function buildPath(item: ActivityTreeItem, seen = new Set<string>()): string {
    const existing = logicalPathById.get(item.id);
    if (existing) return existing;

    if (seen.has(item.id)) {
      return uniqueSegment(item, usedSiblingSlugsByParent, '');
    }

    const nextSeen = new Set(seen);
    nextSeen.add(item.id);
    const parent = item.parentId ? itemById.get(item.parentId) : undefined;
    const parentPath = parent ? buildPath(parent, nextSeen) : '';
    const segment = uniqueSegment(item, usedSiblingSlugsByParent, parentPath);
    const path = parentPath ? `${parentPath}/${segment}` : segment;
    logicalPathById.set(item.id, path);
    return path;
  }

  const parentIds = new Set(items.map((item) => item.parentId).filter((parentId): parentId is string => Boolean(parentId)));
  const logicalEntriesById = new Map(
    items.map((item) => {
      const path = buildPath(item);
      const treePath = parentIds.has(item.id) ? `${path}/` : path;
      pathById.set(item.id, treePath);
      return [item.id, { item, path: treePath }] as const;
    }),
  );
  const childrenByParentId = new Map<string, ActivityTreeItem[]>();
  const rootItems: ActivityTreeItem[] = [];

  for (const item of items) {
    const parent = item.parentId ? itemById.get(item.parentId) : undefined;
    if (!parent) {
      rootItems.push(item);
      continue;
    }

    const siblings = childrenByParentId.get(parent.id) ?? [];
    siblings.push(item);
    childrenByParentId.set(parent.id, siblings);
  }

  const sortByOriginalIndex = (left: ActivityTreeItem, right: ActivityTreeItem) =>
    (originalIndexById.get(left.id) ?? 0) - (originalIndexById.get(right.id) ?? 0);
  for (const children of childrenByParentId.values()) {
    children.sort(sortByOriginalIndex);
  }
  rootItems.sort(sortByOriginalIndex);

  const entries: ActivityTreePathEntry[] = [];
  const visited = new Set<string>();
  function visit(item: ActivityTreeItem) {
    if (visited.has(item.id)) {
      return;
    }
    visited.add(item.id);
    const entry = logicalEntriesById.get(item.id);
    if (entry) {
      entries.push(entry);
    }
    for (const child of childrenByParentId.get(item.id) ?? []) {
      visit(child);
    }
  }

  for (const item of rootItems) {
    visit(item);
  }
  for (const item of items) {
    visit(item);
  }

  const ancestorIdsById = new Map<string, string[]>();
  for (const item of items) {
    const ancestorIds: string[] = [];
    const seen = new Set<string>();
    let parentId = item.parentId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = itemById.get(parentId);
      if (!parent) break;
      ancestorIds.unshift(parent.id);
      parentId = parent.parentId;
    }
    ancestorIdsById.set(item.id, ancestorIds);
  }

  return {
    entries,
    pathById,
    itemById,
    itemByPath: new Map(entries.map((entry) => [entry.path, entry.item])),
    ancestorIdsById,
    paths: entries.map((entry) => entry.path),
  };
}

function uniqueSegment(item: ActivityTreeItem, usedSiblingSlugsByParent: Map<string, Set<string>>, parentPath: string): string {
  const used = usedSiblingSlugsByParent.get(parentPath) ?? new Set<string>();
  usedSiblingSlugsByParent.set(parentPath, used);

  const base = slugTreeSegment(item.title || item.id) || item.kind;
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base} ${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function slugTreeSegment(value: string): string {
  return value
    .replace(/[\\/]+/g, ' ')
    .replace(/[\p{Cc}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
