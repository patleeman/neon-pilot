import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const extensionFacadeOmissions: Record<string, string> = {
  ActionTile: 'desktop app-page composition primitive not yet exposed to extensions',
  AppPageTocItem: 'type for AppPageToc inputs; extensions can use inferred props',
  MediaPreviewButton: 'desktop transcript media control',
  PageHeader: 'desktop page composition primitive',
  TitleButton: 'desktop titlebar control',
  TreeItemButton: 'desktop tree control',
  WorkbenchTab: 'desktop workbench tab primitive',
  WorkbenchTabActionButton: 'desktop workbench tab primitive',
  WorkbenchTabButton: 'desktop workbench tab primitive',
  WorkbenchTabCloseButton: 'desktop workbench tab primitive',
};

function readSource(relativeUrl: string) {
  return readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

function collectExportNames(source: string) {
  const names = new Set<string>();
  for (const match of source.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from/g)) {
    for (const rawPart of match[1].split(',')) {
      const part = rawPart.trim().replace(/^type\s+/, '');
      if (!part) continue;
      names.add(
        part
          .split(/\s+as\s+/)
          .pop()
          ?.trim() ?? part,
      );
    }
  }
  return names;
}

describe('extension UI facade exports', () => {
  it('keeps the extension facade aligned with the public UI primitive surface', () => {
    const publicUiExports = collectExportNames(readSource('../../../../ui/src/index.ts'));
    const extensionUiExports = collectExportNames(readSource('./ui.ts'));
    const omittedExports = new Set(Object.keys(extensionFacadeOmissions));

    const missingFromFacade = [...publicUiExports].filter((name) => !extensionUiExports.has(name) && !omittedExports.has(name)).sort();
    const staleOmissions = [...omittedExports].filter((name) => !publicUiExports.has(name)).sort();
    const exportedOmissions = [...omittedExports].filter((name) => extensionUiExports.has(name)).sort();

    expect(missingFromFacade).toEqual([]);
    expect(staleOmissions).toEqual([]);
    expect(exportedOmissions).toEqual([]);
  });
});
