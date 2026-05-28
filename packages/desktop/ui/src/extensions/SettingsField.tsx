import { type ReactNode } from 'react';

import { cx } from '../components/ui';
import type { UnifiedSettingsEntry } from '../shared/types';

const INPUT_CLASS =
  'w-full rounded-lg border border-border-subtle bg-surface/70 px-3 py-2 text-[13px] text-primary shadow-none transition-colors focus:border-accent/50 focus:bg-surface focus:outline-none disabled:opacity-50';
const COMPACT_INPUT_CLASS =
  'rounded-lg border border-border-subtle bg-surface/70 px-3 py-2 text-[13px] text-primary shadow-none transition-colors focus:border-accent/50 focus:bg-surface focus:outline-none disabled:opacity-50';
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
    <div className="space-y-2 py-3 first:pt-0">
      <label className="block text-[13px] font-medium text-primary">
        {label}
        {entry.description ? <span className="ml-2 font-normal text-[12px] text-secondary"> {entry.description}</span> : null}
      </label>

      {renderControl(entry, currentValue, handleChange)}
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
      return (
        <label className="inline-flex items-center gap-3 text-[14px] text-primary">
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-border-default bg-base text-accent focus:ring-0 focus:outline-none"
          />
          <span>Enabled</span>
        </label>
      );

    case 'select':
      return (
        <select value={String(currentValue)} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
          {(entry.enum ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case 'number':
      return (
        <input
          type="number"
          value={currentValue as number}
          placeholder={entry.placeholder}
          onChange={(e) => onChange(Number(e.target.value))}
          className={INPUT_CLASS}
        />
      );

    default:
      return (
        <input
          type="text"
          value={String(currentValue)}
          placeholder={entry.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLASS} font-mono text-[13px]`}
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
    <div className="space-y-2">
      <div className="space-y-2">
        {rows.map((item, index) => (
          <div key={index} className="grid max-w-[640px] grid-cols-[92px_minmax(0,500px)_28px] items-center gap-2">
            <select
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
              className={COMPACT_INPUT_CLASS}
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>
            <input
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
              className={cx(COMPACT_INPUT_CLASS, 'min-w-0')}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              aria-label={`Remove reply action ${index + 1}`}
              title="Remove"
              onClick={() => updateItems(rows.filter((_, itemIndex) => itemIndex !== index))}
              className="h-8 w-7 text-[18px] leading-none text-secondary transition-colors hover:text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => updateItems([...rows, { emoji: EMOJI_OPTIONS[0], label: '' }])}
        className="rounded-lg border border-border-subtle bg-surface/60 px-3 py-1.5 text-[12px] font-medium text-secondary transition-colors hover:border-border-default hover:bg-surface hover:text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
      >
        Add action
      </button>
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
