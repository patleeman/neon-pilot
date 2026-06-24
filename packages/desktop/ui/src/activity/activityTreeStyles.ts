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
  if (accentColor && backgroundColor) {
    declarations.push(`background: linear-gradient(to right, ${accentColor} 0 2px, transparent 2px), ${backgroundColor};`);
  } else if (accentColor) {
    declarations.push(`background-image: linear-gradient(to right, ${accentColor} 0 2px, transparent 2px);`);
  } else if (backgroundColor) {
    declarations.push(`background: ${backgroundColor};`);
  }

  return `button[data-item-path="${escapeCssString(path)}"] { ${declarations.join(' ')} }`;
}
