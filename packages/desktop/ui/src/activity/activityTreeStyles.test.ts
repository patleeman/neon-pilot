import { describe, expect, it } from 'vitest';

import type { ActivityTreeItem } from './activityTree';
import { buildActivityTreePathModel } from './activityTreePaths';
import { buildActivityTreeUnsafeCss } from './activityTreeStyles';

function item(overrides: Partial<ActivityTreeItem> & Pick<ActivityTreeItem, 'id' | 'title'>): ActivityTreeItem {
  return {
    kind: overrides.kind ?? 'conversation',
    status: overrides.status ?? 'idle',
    ...overrides,
  };
}

describe('buildActivityTreeUnsafeCss', () => {
  it('adds safe accent and background styles for activity rows', () => {
    const model = buildActivityTreePathModel([
      item({ id: 'conversation:1', title: 'Build tree', accentColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.12)' }),
    ]);

    expect(buildActivityTreeUnsafeCss(model)).toContain(
      'button[data-item-path="Build tree"] { background: linear-gradient(to right, #8b5cf6 0 2px, transparent 2px), rgba(139, 92, 246, 0.12); }',
    );
  });

  it('drops unsafe color values', () => {
    const model = buildActivityTreePathModel([
      item({ id: 'conversation:1', title: 'Bad color', accentColor: 'url(javascript:alert(1))', backgroundColor: 'red' }),
    ]);

    expect(buildActivityTreeUnsafeCss(model)).toBe('');
  });

  it('escapes path selectors', () => {
    const model = buildActivityTreePathModel([item({ id: 'conversation:1', title: 'Quote " Tree', accentColor: '#fff' })]);

    expect(buildActivityTreeUnsafeCss(model)).toContain('button[data-item-path="Quote \\" Tree"]');
  });
});
