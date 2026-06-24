import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import CodeMirror from '@uiw/react-codemirror';
import { useCallback, useMemo } from 'react';

import type { WorkspaceDiffOverlay } from '../../shared/types';

const neonPilotDarkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#b8a7d9' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#d3a17d' },
  { tag: [t.number, t.integer, t.float], color: '#d3a17d' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#94b98e' },
  { tag: [t.escape, t.character], color: '#98b8d2' },
  { tag: [t.definition(t.variableName), t.function(t.variableName), t.function(t.propertyName)], color: '#9fb7de' },
  { tag: [t.variableName, t.self], color: '#d7d3c5' },
  { tag: [t.className, t.typeName, t.namespace], color: '#8fbfc1' },
  { tag: [t.propertyName, t.attributeName], color: '#a9bfd0' },
  { tag: [t.operator, t.punctuation, t.bracket], color: '#c2bdad' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#7d7a6b', fontStyle: 'italic' },
  { tag: [t.meta, t.labelName], color: '#b8a7d9' },
  { tag: [t.heading, t.strong], color: '#f5f3e8', fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: '#8ebcad', textDecoration: 'underline' },
  { tag: t.invalid, color: '#e07f8b' },
]);

const neonPilotLightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#6f5a9c' },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: '#9a5f2d' },
  { tag: [t.number, t.integer, t.float], color: '#9a5f2d' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#4f7a44' },
  { tag: [t.escape, t.character], color: '#34708e' },
  { tag: [t.definition(t.variableName), t.function(t.variableName), t.function(t.propertyName)], color: '#315f9d' },
  { tag: [t.variableName, t.self], color: '#33342e' },
  { tag: [t.className, t.typeName, t.namespace], color: '#24747a' },
  { tag: [t.propertyName, t.attributeName], color: '#3f667d' },
  { tag: [t.operator, t.punctuation, t.bracket], color: '#62675e' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#777569', fontStyle: 'italic' },
  { tag: [t.meta, t.labelName], color: '#6f5a9c' },
  { tag: [t.heading, t.strong], color: '#20201a', fontWeight: '600' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.link, color: '#2d756a', textDecoration: 'underline' },
  { tag: t.invalid, color: '#b43e4a' },
]);

function extensionForPath(path: string) {
  const lower = path.toLowerCase();
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(lower)) {
    return javascript({ jsx: /\.(tsx|jsx)$/.test(lower), typescript: /\.(ts|tsx)$/.test(lower) });
  }
  if (/\.jsonc?$/.test(lower)) return json();
  if (/\.(md|mdx|markdown)$/.test(lower)) return markdown();
  if (/\.py$/.test(lower)) return python();
  if (/\.(html|xml|svg)$/.test(lower)) return html();
  if (/\.(css|scss|sass|less)$/.test(lower)) return css();
  if (/\.(ya?ml)$/.test(lower)) return yaml();
  return [];
}

class DeletedLinesWidget extends WidgetType {
  constructor(private readonly lines: string[]) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'workspace-deleted-lines';
    for (const line of this.lines) {
      const row = document.createElement('div');
      row.className = 'workspace-deleted-line';
      const marker = document.createElement('span');
      marker.className = 'workspace-diff-marker';
      marker.textContent = '-';
      const text = document.createElement('span');
      text.textContent = line || ' ';
      row.append(marker, text);
      wrapper.append(row);
    }
    return wrapper;
  }
}

const setDiffDecorations = StateEffect.define<WorkspaceDiffOverlay>();

function buildDiffDecorations(spec: WorkspaceDiffOverlay, state: EditorState): DecorationSet {
  const added = new Set(spec.addedLines);
  const builder = new RangeSetBuilder<Decoration>();
  const blocksByLine = new Map<number, string[]>();
  for (const block of spec.deletedBlocks) {
    blocksByLine.set(block.afterLine, [...(blocksByLine.get(block.afterLine) ?? []), ...block.lines]);
  }

  const beforeFirst = blocksByLine.get(0);
  if (beforeFirst?.length) {
    builder.add(0, 0, Decoration.widget({ widget: new DeletedLinesWidget(beforeFirst), side: -1, block: true }));
  }

  for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber += 1) {
    const line = state.doc.line(lineNumber);
    if (added.has(lineNumber)) {
      builder.add(line.from, line.from, Decoration.line({ class: 'workspace-added-line' }));
    }
    const deleted = blocksByLine.get(lineNumber);
    if (deleted?.length) {
      builder.add(line.to, line.to, Decoration.widget({ widget: new DeletedLinesWidget(deleted), side: 1, block: true }));
    }
  }

  return builder.finish();
}

const diffDecorationsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDiffDecorations)) {
        return buildDiffDecorations(effect.value, transaction.state);
      }
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

function isDarkEditorTheme(theme: string): boolean {
  const appearance = typeof document === 'undefined' ? null : document.documentElement.getAttribute('data-theme-appearance');
  if (appearance === 'dark') return true;
  if (appearance === 'light') return false;
  return theme === 'dark' || theme.endsWith('-dark');
}

function createWorkspaceEditorExtensions(path: string, theme: string) {
  const isDark = isDarkEditorTheme(theme);
  return [
    diffDecorationsField,
    EditorView.lineWrapping,
    EditorView.theme(
      {
        '&': {
          height: '100%',
          background: 'rgb(var(--color-base))',
          color: 'rgb(var(--color-primary))',
          fontSize: '12px',
        },
        '.cm-editor': { height: '100%', backgroundColor: 'rgb(var(--color-base))' },
        '.cm-scroller': {
          backgroundColor: 'rgb(var(--color-base))',
          fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineHeight: '1.65',
        },
        '.cm-content': { padding: '14px 0 24px' },
        '.cm-line': { paddingLeft: '0' },
        '.cm-gutters': {
          background: 'rgb(var(--color-surface))',
          color: 'rgb(var(--color-dim))',
          borderRight: '1px solid rgb(var(--color-border-subtle))',
          fontFamily: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '11px',
          padding: '14px 6px 24px 0',
        },
        '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgb(var(--color-surface) / 0.55)' },
        '.cm-cursor': { borderLeftColor: 'rgb(var(--color-primary))' },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          backgroundColor: isDark ? 'rgb(var(--color-selection))' : 'rgb(var(--color-accent) / 0.24)',
        },
        '.cm-panels': {
          background: 'transparent',
          color: 'rgb(var(--color-primary))',
          border: '0',
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        },
        '.cm-panels-bottom': {
          bottom: '12px',
          left: '12px',
          right: '12px',
          width: 'auto',
          zIndex: '8',
          pointerEvents: 'none',
        },
        '.cm-panel.cm-search': {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          minWidth: '0',
          padding: '10px 12px',
          border: '1px solid rgb(var(--color-border))',
          borderRadius: '12px',
          background: 'rgb(var(--color-surface) / 0.96)',
          boxShadow: '0 18px 50px rgb(0 0 0 / 0.32)',
          backdropFilter: 'blur(14px)',
          pointerEvents: 'auto',
        },
        '.cm-panel.cm-search label': {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          margin: '0',
          color: 'rgb(var(--color-dim))',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        },
        '.cm-panel.cm-search label:first-of-type': { flex: '1 1 auto', minWidth: '220px' },
        '.cm-panel.cm-search label:nth-of-type(2)': { flex: '0 1 240px', minWidth: '160px' },
        '.cm-panel.cm-search input[type="text"]': {
          boxSizing: 'border-box',
          height: '32px',
          width: '100%',
          minWidth: '0',
          border: '1px solid rgb(var(--color-border-subtle))',
          borderRadius: '9px',
          background: 'rgb(var(--color-base) / 0.9)',
          color: 'rgb(var(--color-primary))',
          padding: '0 11px',
          fontSize: '12px',
          outline: 'none',
        },
        '.cm-panel.cm-search input[type="text"]::placeholder': { color: 'rgb(var(--color-dim) / 0.72)' },
        '.cm-panel.cm-search input[type="text"]:focus': {
          borderColor: 'rgb(var(--color-accent) / 0.65)',
          boxShadow: '0 0 0 2px rgb(var(--color-accent) / 0.16)',
        },
        '.cm-panel.cm-search label:has(input[type="checkbox"])': { flex: '0 0 auto', gap: '5px' },
        '.cm-panel.cm-search input[type="checkbox"]': {
          width: '13px',
          height: '13px',
          margin: '0',
          accentColor: 'rgb(var(--color-accent))',
        },
        '.cm-panel.cm-search button': {
          flex: '0 0 auto',
          height: '32px',
          border: '1px solid rgb(var(--color-border-subtle))',
          borderRadius: '9px',
          background: 'rgb(var(--color-base) / 0.82)',
          color: 'rgb(var(--color-secondary))',
          padding: '0 10px',
          fontSize: '11px',
          fontWeight: '500',
        },
        '.cm-panel.cm-search button:hover': {
          borderColor: 'rgb(var(--color-border))',
          background: 'rgb(var(--color-base))',
          color: 'rgb(var(--color-primary))',
        },
        '.cm-panel.cm-search button[name="close"]': { display: 'none' },
        '::selection': {
          backgroundColor: isDark ? 'rgb(var(--color-selection))' : 'rgb(var(--color-accent) / 0.24)',
          color: isDark ? 'rgb(var(--color-primary))' : undefined,
        },
        '.workspace-added-line': { backgroundColor: 'rgba(34, 197, 94, 0.12)' },
        '.workspace-deleted-lines': {
          backgroundColor: 'rgba(239, 68, 68, 0.10)',
          color: 'rgb(var(--color-danger))',
          borderLeft: '2px solid rgba(239, 68, 68, 0.6)',
          padding: '2px 0 2px 8px',
          fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '12px',
        },
        '.workspace-deleted-line': { whiteSpace: 'pre', minHeight: '1.4em' },
        '.workspace-diff-marker': { display: 'inline-block', width: '1.5em', opacity: '0.75' },
      },
      { dark: isDark },
    ),
    syntaxHighlighting(isDark ? neonPilotDarkHighlightStyle : neonPilotLightHighlightStyle),
    extensionForPath(path),
  ];
}

export function WorkspaceCodeEditor({
  path,
  value,
  theme,
  diffSpec,
  editable,
  onChange,
}: {
  path: string;
  value: string;
  theme: string;
  diffSpec: WorkspaceDiffOverlay;
  editable: boolean;
  onChange?: (value: string) => void;
}) {
  const editorExtensions = useMemo(() => createWorkspaceEditorExtensions(path, theme), [path, theme]);
  const onEditorCreate = useCallback(
    (view: EditorView) => {
      view.dispatch({ effects: setDiffDecorations.of(diffSpec) });
    },
    [diffSpec],
  );

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme="none"
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false, highlightActiveLineGutter: false }}
      editable={editable}
      readOnly={!editable}
      extensions={editorExtensions}
      onChange={onChange}
      onCreateEditor={onEditorCreate}
      style={{ backgroundColor: 'rgb(var(--color-base))', color: 'rgb(var(--color-primary))', height: '100%' }}
      key={`${path}:${editable}:${diffSpec.addedLines.length}:${diffSpec.deletedBlocks.length}`}
    />
  );
}
