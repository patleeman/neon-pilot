import { type ReactNode } from 'react';

import { cx, FieldHint, FieldLabel, IconButton, Select, Switch, TextInput } from '../components/ui';
import type { UnifiedSettingsEntry } from '../shared/types';

const EMOJI_OPTIONS = ['👍', '👎', '✅', '❓', '💡', '📋', '❤️', '🚀', '👀', '🙌', '🙏', '⚠️'];

interface SettingsFieldProps {
  entry: UnifiedSettingsEntry;
  value: unknown;
  description?: string;
  onChange: (key: string, value: unknown) => void;
}

export function SettingsField({ entry, value, onChange }: SettingsFieldProps) {
  const currentValue = value ?? entry.default;
  const label = formatSettingsFieldLabel(entry.key);

  const handleChange = (newValue: unknown) => {
    onChange(entry.key, newValue);
  };

  return (
    <div className="grid gap-2 border-b border-border-subtle/60 py-2.5 last:border-b-0 sm:grid-cols-[minmax(10rem,14rem)_minmax(0,1fr)] sm:items-start">
      <div className="min-w-0 pt-1">
        <FieldLabel>{label}</FieldLabel>
        {entry.description ? <FieldHint className="line-clamp-2">{entry.description}</FieldHint> : null}
      </div>
      <div className="min-w-0">{renderControl(entry, currentValue, handleChange)}</div>
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

  switch (entry.type) {
    case 'boolean':
      return <Switch checked={Boolean(currentValue)} label="Enabled" onClick={() => onChange(!currentValue)} />;

    case 'select':
      return (
        <Select value={String(currentValue)} onChange={(e) => onChange(e.target.value)} className="bg-surface/70">
          {(entry.enum ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
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

function replaceAt(items: EmojiLabelItem[], index: number, item: EmojiLabelItem): EmojiLabelItem[] {
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
