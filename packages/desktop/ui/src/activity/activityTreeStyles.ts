import type { ActivityTreeItem } from './activityTree';
import type { ActivityTreePathModel } from './activityTreePaths';
import { escapeCssString, sanitizeCssColor } from './cssColors';

export function buildActivityTreeUnsafeCss(pathModel: ActivityTreePathModel): string {
  const rules: string[] = [];

  for (const entry of pathModel.entries) {
    const rule = buildActivityTreeItemCssRule(entry.path, entry.item);
    if (rule) rules.push(rule);
  }

  return rules.join('\n');
}

function buildActivityTreeItemCssRule(path: string, item: ActivityTreeItem): string | null {
  const accentColor = sanitizeCssColor(item.accentColor);
  const backgroundColor = sanitizeCssColor(item.backgroundColor);
  if (!accentColor && !backgroundColor) return null;

  const declarations: string[] = [];
  if (accentColor) {
    declarations.push(`box-shadow: inset 2px 0 0 ${accentColor};`);
  }
  if (backgroundColor) {
    declarations.push(`background: ${backgroundColor};`);
  }

  return `button[data-item-path="${escapeCssString(path)}"] { ${declarations.join(' ')} }`;
}
