import { type ReactNode } from 'react';

import { Checkbox, cx, IconButton, Select, Switch, TextInput } from '../components/ui';
import type { UnifiedSettingsEntry } from '../shared/types';

const EMOJI_OPTIONS = ['👍', '👎', '✅', '❓', '💡', '📋', '❤️', '🚀', '👀', '🙌', '🙏', '⚠️'];
const COMMON_AGENT_TOOLS = ['bash', 'read', 'edit', 'write', 'artifact', 'checkpoint', 'mcp', 'subagent'];

interface SettingsFieldProps {
  entry: UnifiedSettingsEntry;
  value: unknown;
  label?: ReactNode;
  description?: string;
  showDescription?: boolean;
  onChange: (key: string, value: unknown) => void;
}

export function SettingsField({ entry, value, label: labelOverride, description, showDescription = true, onChange }: SettingsFieldProps) {
  const currentValue = value ?? entry.default;
  const label = labelOverride ?? formatSettingsFieldLabel(entry.key);
  const hint = description ?? entry.description;
  const isBoolean = entry.type === 'boolean';

  const handleChange = (newValue: unknown) => {
    onChange(entry.key, newValue);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle/60 px-3 py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1 pt-0.5">
        <span className="block text-[13px] font-medium leading-5 text-primary">{label}</span>
        {showDescription && hint ? (
          <span className="line-clamp-2 block max-w-[34rem] text-[12px] leading-5 text-secondary">{hint}</span>
        ) : null}
      </div>
      <div className={cx('min-w-0', isBoolean ? 'sm:w-auto sm:flex-shrink-0 sm:self-center' : 'sm:w-[min(100%,32rem)] sm:flex-shrink-0')}>
        {renderControl(entry, currentValue, handleChange)}
      </div>
    </div>
  );
}

function formatSettingsFieldLabel(key: string): string {
  const segment = key.split('.').pop() ?? key;
  return segment
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());
}

function renderControl(entry: UnifiedSettingsEntry, currentValue: unknown, onChange: (value: unknown) => void): ReactNode {
  if (entry.control === 'emoji-label-list') {
    return <EmojiLabelListControl value={currentValue} placeholder={entry.placeholder} onChange={onChange} />;
  }
  if (entry.control === 'agent-tool-list') {
    return <AgentToolListControl value={currentValue} placeholder={entry.placeholder} onChange={onChange} />;
  }

  switch (entry.type) {
    case 'boolean':
      return <Switch checked={Boolean(currentValue)} label="Enabled" onClick={() => onChange(!currentValue)} />;

    case 'select':
      return (
        <Select value={String(currentValue)} onChange={(e) => onChange(e.target.value)} className="bg-surface/70">
          {(entry.enum ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {entry.enumLabels?.[opt] ?? opt}
            </option>
          ))}
        </Select>
      );

    case 'number':
      return (
        <TextInput
          type="number"
          value={currentValue as number}
          placeholder={entry.placeholder}
          onChange={(e) => onChange(Number(e.target.value))}
          className="bg-surface/70"
        />
      );

    default:
      return (
        <TextInput
          type="text"
          value={String(currentValue)}
          placeholder={entry.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="bg-surface/70 font-mono"
          autoComplete="off"
          spellCheck={false}
        />
      );
  }
}

interface EmojiLabelItem {
  emoji: string;
  label: string;
}

function EmojiLabelListControl({
  value,
  placeholder,
  onChange,
}: {
  value: unknown;
  placeholder?: string;
  onChange: (value: unknown) => void;
}) {
  const items = parseEmojiLabelItems(value);
  const rows = items.length ? items : [{ emoji: EMOJI_OPTIONS[0], label: '' }];

  const updateItems = (nextItems: EmojiLabelItem[]) => {
    onChange(serializeEmojiLabelItems(nextItems));
  };

  return (
    <div className="space-y-1.5">
      <div className="space-y-2">
        {rows.map((item, index) => (
          <div key={index} className="grid max-w-[640px] grid-cols-[76px_minmax(0,500px)_28px] items-center gap-1.5">
            <Select
              aria-label={`Emoji for reply action ${index + 1}`}
              value={item.emoji}
              onChange={(e) =>
                updateItems(
                  replaceAt(rows, index, {
                    ...item,
                    emoji: e.target.value,
                  }),
                )
              }
              className="bg-surface/70"
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </Select>
            <TextInput
              type="text"
              aria-label={`Label for reply action ${index + 1}`}
              value={item.label}
              placeholder={placeholder ?? 'Label'}
              onChange={(e) =>
                updateItems(
                  replaceAt(rows, index, {
                    ...item,
                    label: e.target.value,
                  }),
                )
              }
              className={cx('min-w-0 bg-surface/70')}
              autoComplete="off"
              spellCheck={false}
            />
            <IconButton
              compact
              aria-label={`Remove reply action ${index + 1}`}
              title="Remove"
              onClick={() => updateItems(rows.filter((_, itemIndex) => itemIndex !== index))}
            >
              ×
            </IconButton>
          </div>
        ))}
      </div>
      <IconButton
        compact
        aria-label="Add reply action"
        title="Add"
        onClick={() => updateItems([...rows, { emoji: EMOJI_OPTIONS[0], label: '' }])}
      >
        +
      </IconButton>
    </div>
  );
}

function replaceAt<T>(items: T[], index: number, item: T): T[] {
  return items.map((current, itemIndex) => (itemIndex === index ? item : current));
}

function parseEmojiLabelItems(value: unknown): EmojiLabelItem[] {
  return String(value ?? '')
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      const [emoji = EMOJI_OPTIONS[0], ...labelParts] = trimmed.split(/\s+/);
      return { emoji, label: labelParts.join(' ') };
    })
    .filter((item) => item.emoji.trim() || item.label.trim());
}

function serializeEmojiLabelItems(items: EmojiLabelItem[]): string {
  return items
    .map((item) => `${item.emoji.trim()} ${item.label.trim()}`.trim())
    .filter(Boolean)
    .join(', ');
}

function AgentToolListControl({
  value,
  placeholder,
  onChange,
}: {
  value: unknown;
  placeholder?: string;
  onChange: (value: unknown) => void;
}) {
  const tools = parseToolNames(value);
  const selectedCommonTools = tools.filter((tool) => COMMON_AGENT_TOOLS.includes(tool));
  const customTools = tools.filter((tool) => !COMMON_AGENT_TOOLS.includes(tool));
  const rows = customTools.length ? customTools : [''];

  const emit = (commonTools: string[], customToolRows: string[]) => {
    onChange(serializeToolNames([...commonTools, ...customToolRows]));
  };

  const toggleCommonTool = (tool: string) => {
    const nextCommonTools = selectedCommonTools.includes(tool)
      ? selectedCommonTools.filter((current) => current !== tool)
      : [...selectedCommonTools, tool];
    emit(nextCommonTools, customTools);
  };

  const updateCustomTool = (index: number, tool: string) => {
    emit(selectedCommonTools, replaceAt(rows, index, tool));
  };

  const removeCustomTool = (index: number) => {
    emit(
      selectedCommonTools,
      rows.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5 text-[12px] text-secondary sm:grid-cols-4">
        {COMMON_AGENT_TOOLS.map((tool) => (
          <label key={tool} className="flex min-w-0 items-center gap-1.5 rounded border border-border-subtle/70 bg-surface/70 px-2 py-1.5">
            <Checkbox
              checked={selectedCommonTools.includes(tool)}
              onChange={() => toggleCommonTool(tool)}
              className="size-3.5 shrink-0 accent-accent"
            />
            <span className="truncate font-mono text-[11px] text-primary">{tool}</span>
          </label>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((tool, index) => (
          <div key={index} className="grid max-w-[640px] grid-cols-[minmax(0,1fr)_28px] items-center gap-1.5">
            <TextInput
              type="text"
              aria-label={`Additional agent tool ${index + 1}`}
              value={tool}
              placeholder={placeholder ?? 'Custom tool name'}
              onChange={(e) => updateCustomTool(index, e.target.value)}
              className={cx('min-w-0 bg-surface/70 font-mono')}
              autoComplete="off"
              spellCheck={false}
            />
            <IconButton
              compact
              aria-label={`Remove additional agent tool ${index + 1}`}
              title="Remove"
              onClick={() => removeCustomTool(index)}
            >
              ×
            </IconButton>
          </div>
        ))}
      </div>
      <IconButton compact aria-label="Add additional agent tool" title="Add" onClick={() => emit(selectedCommonTools, [...rows, ''])}>
        +
      </IconButton>
    </div>
  );
}

function parseToolNames(value: unknown): string[] {
  return Array.from(
    new Set(
      String(value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  );
}

function serializeToolNames(tools: string[]): string {
  return Array.from(new Set(tools.map((tool) => tool.trim()).filter(Boolean))).join(',');
}
